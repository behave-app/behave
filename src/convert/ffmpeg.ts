import { xxh64sum } from 'src/lib/fileutil'
import type * as LibAVTypes from '../../public/app/bundled/libavjs/dist/libav.types'
import type {FileTreeLeaf} from "../lib/FileTree.js"
import {getNumberOfFrames} from "../lib/video.js"

declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

const PROGRESSFILENAME = "__progress__"

export async function getOutputFilename(file: File): Promise<string> {
  const parts = file.name.split(".")
  const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
  const hash = await xxh64sum(file)
  const filename = [...baseparts, hash, "mp4"].join(".")
  return filename
}


export async function convert(
  input: File,
  outputstream: FileSystemWritableFileStream,
  onProgress: (progress: FileTreeLeaf["progress"]) => void
) {
  const numberOfFrames = await getNumberOfFrames(input)
  const reportedFramedPerFrame = input.name.endsWith(".MTS") ? 2 : 1  // TODO better check for interlaced

  const outputname = await getOutputFilename(input)
  const libav = await window.LibAV.LibAV({noworker: false, nothreads: true});
  try {
    await libav.mkreadaheadfile(input.name, input)
    await libav.mkwriterdev(outputname)
    await libav.mkstreamwriterdev(PROGRESSFILENAME)
    const writePromises: Set<Promise<unknown>> = new Set()
    let progressController = null as unknown as ReadableStreamDefaultController<ArrayBuffer>
    const progressStream = new ReadableStream({
      start(controller) {
        progressController = controller
      }
    }).pipeThrough(new TextDecoderStream())
    libav.onwrite = function(name, pos, data) {
      if (name === PROGRESSFILENAME) {
        progressController.enqueue(data)
        return
      }
      const promise = outputstream.write(
        {type: "write", data: data.slice(0), position: pos})
      writePromises.add(promise)
      void(promise.then(() => {writePromises.delete(promise)}))
    }
    let progressStreamLeftOver = ""
    void(progressStream.pipeTo(new WritableStream({
      write(chunk: string) {
        const parts = (progressStreamLeftOver + chunk).split("\n")
        progressStreamLeftOver = parts.slice(-1)[0]
        const lines = parts.slice(0, -1)
        for (const line of lines) {
          const [key, value] = line.split("=")
          if (key  === "frame") {
            const framenr = parseInt(value)
            if (Number.isInteger(framenr)) {
              onProgress({"converting":
                Math.min(framenr / reportedFramedPerFrame / numberOfFrames, 1)})
            }
          }
        }
      }
    })))

    const exit_code = await libav.ffmpeg(
      "-i", input.name,
      "-nostdin",
      "-c:v", "copy",
      "-an",
      "-hide_banner",
      "-loglevel", "error",
      "-progress", PROGRESSFILENAME,
      "-y", outputname
    )
    await Promise.all(writePromises)
    await libav.unlink(input.name)
    await libav.unlink(outputname)
    await libav.unlink(PROGRESSFILENAME)
    if (progressController) {
      progressController.close()
    }
    if (exit_code != 0) {
      throw new Error(`ffprobe exit code: ${exit_code}`)
    }
  } finally {
    libav.terminate()
  }
}
