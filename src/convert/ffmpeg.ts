import type * as LibAVTypes from '../../public/app/bundled/libavjs/dist/libav.types'
import type {FileTreeLeaf} from "../lib/FileTree.js"
import {getNumberOfFrames} from "../lib/video.js"

declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

const PROGRESSFILENAME = "__progress__"

export function getOutputFilename(inputfilename: string): string {
  const parts = inputfilename.split(".")
  const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
  return [...baseparts, "mp4"].join(".")
}


export async function convert(
  input: File,
  outputstream: FileSystemWritableFileStream,
  onProgress: (progress: FileTreeLeaf["progress"]) => void
) {
  const numberOfFrames = await getNumberOfFrames(input)
  const reportedFramedPerFrame = input.name.endsWith(".MTS") ? 2 : 1  // TODO better check for interlaced

  const outputname = getOutputFilename(input.name)
  const libav = await window.LibAV.LibAV({noworker: false, nothreads: true});
  try {
    await libav.mkreadaheadfile(input.name, input)
    await libav.mkwriterdev(outputname)
    await libav.mkstreamwriterdev(PROGRESSFILENAME)
    const writePromises: Set<Promise<any>> = new Set()
    let progressController: ReadableStreamDefaultController<ArrayBuffer> = null as any
    let progressStream = new ReadableStream({
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
      promise.then(() => {writePromises.delete(promise)})
    }
    let progressStreamLeftOver = ""
    progressStream.pipeTo(new WritableStream({
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
    }))

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
    libav.unlink(input.name)
    libav.unlink(outputname)
    libav.unlink(PROGRESSFILENAME)
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
