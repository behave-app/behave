import type * as LibAVTypes from '../../public/app/bundled/libavjs/dist/libav.types'
import type {FileTreeLeaf} from "../lib/FileTree.js"

declare global {
  interface Window {
    LibAV: LibAVTypes.LibAVWrapper
  }
}

const PROGRESSFILENAME = "__progress__"
const FFPROBEOUTPUT = "__ffprobe_output__"

export function getOutputFilename(inputfilename: string): string {
  const parts = inputfilename.split(".")
  const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
  return [...baseparts, "mp4"].join(".")
}

export async function getNumberOfFrames(input: File): Promise<number> {
  const libav = await window.LibAV.LibAV({noworker: false, nothreads: true});
  try {
    await libav.mkreadaheadfile(input.name, input)
    await libav.mkwriterdev(FFPROBEOUTPUT)
    let writtenData = new Uint8Array(0);
    libav.onwrite = function(_name, pos, data) {
      const newLen = Math.max(writtenData.length, pos + data.length);
      if (newLen > writtenData.length) {
        const newData = new Uint8Array(newLen);
        newData.set(writtenData);
        writtenData = newData;
      }
      writtenData.set(data, pos);
    };
    const exit_code = await libav.ffprobe(
      "-show_streams",
      "-hide_banner",
      "-loglevel", "error",
      "-of", "json",
      "-o", FFPROBEOUTPUT,
      input.name
    )
    if (exit_code != 0) {
      throw new Error(`ffprobe exit code: ${exit_code}`)
    }
    libav.unlink(input.name)
    libav.unlink(FFPROBEOUTPUT)
    // should we destroy libavjs? // TODO
    const outputjson = new TextDecoder("utf-8").decode(writtenData)
    try {
      const videostreams = JSON.parse(outputjson).streams.filter((s: any) => s.codec_type === "video")
      if (videostreams.length !== 1) {
        throw new Error("Too many videostreams")
      }
      const duration = parseFloat(videostreams[0].duration)
      const r_frame_rate = videostreams[0].r_frame_rate.split("/")
      const nrframes = Math.round(duration / parseInt(r_frame_rate[1] ?? "1") * parseInt(r_frame_rate[0]))
      if (!Number.isInteger(nrframes)) {
        throw new Error(`Unexpected number of frames: ${nrframes}`)
      }
      return nrframes
    } catch (e) {
      throw new Error(`Problem parsing number of packets: ${JSON.stringify(outputjson)}; ${e}}`)
    }
  } finally {
    libav.terminate()
  }
}

export async function convert(
  input: File,
  outputstream: FileSystemWritableFileStream,
  onProgress: (progress: FileTreeLeaf["progress"]) => void
) {
  const numberOfFrames = await getNumberOfFrames(input)

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
              onProgress({"converting": Math.min(framenr / numberOfFrames, 1)})
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
