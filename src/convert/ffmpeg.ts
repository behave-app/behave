import { xxh64sum } from '../lib/fileutil'
import type * as LibAVTypes from '../../public/app/bundled/libavjs/dist/libav.types'
import type {FileTreeLeaf} from "../lib/FileTree"
import {Video} from "../lib/video"
import { ObjectEntries, ObjectFromEntries, assert } from '../lib/util'
import { ISODateTimeString, SingleFrameInfo, getPartsFromTimestamp, partsToIsoDate } from '../lib/detections'

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
  const filename = [...baseparts, hash, "behave", "mp4"].join(".")
  return filename
}

const getCompressedFrameInfo = (
  frameInfo: ReadonlyMap<number, Omit<SingleFrameInfo, "detections">>
): {
  recordTimeFramesPerSecond: number,
  startTimestamps: Record<number, ISODateTimeString>
  iFrameInterval: number,
  iFrameStarts: number[],
  idrFrameInterval: number,
  idrFrameStarts: number[],
} => {
  const timestamps = new Map(
    [...frameInfo.entries()].filter(
      ([_, frameInfo]) => frameInfo.timestamp !== undefined).map(
        ([framenr, frameInfo]) => [framenr, frameInfo.timestamp!] as const))
  if (timestamps.size < 2) {
    throw new Error("Not enough timestamps can be found, "
    + "maybe file is not supported")
  }
  const timestampEntries = [...timestamps.entries()]
  const frameNrAndTimestampParts = timestampEntries.map(
    ([framenr, isots]) => [framenr, getPartsFromTimestamp(isots)] as const)
  const tzs = new Set(frameNrAndTimestampParts.map(([_, parts]) => parts.tz))
  if (tzs.size != 1) {
    throw new Error("The timezone changes halfway the video, this is TODO: "
      + JSON.stringify([...tzs]))
  }
  const [firstFrameNumber, firstParts] = frameNrAndTimestampParts.at(0)!
  const [lastFrameNumber, lastParts] = frameNrAndTimestampParts.at(-1)!
  const recordTimeFramesPerSecond = (lastParts.date.valueOf() - firstParts.date.valueOf()) / 1000 / (lastFrameNumber - firstFrameNumber)

  const wholeRecordTimeFramesPerSecond = Math.round(recordTimeFramesPerSecond)
  if (Math.abs(recordTimeFramesPerSecond - wholeRecordTimeFramesPerSecond) > .05) {
    throw new Error("non-int record frames per second is not yet supported, TODO: "
    + recordTimeFramesPerSecond)
  }
  const newTSs = [[firstFrameNumber, firstParts] as const]
  for (const [framenr, parts] of frameNrAndTimestampParts) {
    const [lastTSFramenr, lastTSParts] = newTSs.at(-1)!
    const expectedTimestamp = lastTSParts.date.valueOf() + 1000 / wholeRecordTimeFramesPerSecond * (framenr - lastTSFramenr)
    if (expectedTimestamp !== parts.date.valueOf()) {
      newTSs.push([framenr, parts])
    }
  }

  const iFrames = [...frameInfo.entries()].filter(
    ([_, frameInfo]) => frameInfo.type === "I" || frameInfo.type === "IDR").map(
    ([framenr]) => framenr)
  const idrFrames = [...frameInfo.entries()].filter(
    ([_, frameInfo]) => frameInfo.type === "IDR").map(([framenr]) => framenr)

  const getIntervalAndStarts = (list: number[]): [number, number[]] => {
    if (list.length === 0) {
      return [NaN, []]
    }
    if (list.length === 1) {
      return [NaN, [...list]]
    }
    const intervals: number[] = []
    for (let i = 1; i < list.length; i++) {
      intervals.push(list[i] - list[i - 1])
    }
    const maxInterval = Math.max(...intervals)
    const startIndices = [0, ...intervals.map((interval, idx) => [interval, idx])
      .filter(([interval]) => interval !== maxInterval).map(([_, idx]) => idx)]
    return [maxInterval, startIndices.map(i => list[i])]
  }

  const [iFrameInterval, iFrameStarts] = getIntervalAndStarts(iFrames)
  const [idrFrameInterval, idrFrameStarts] = getIntervalAndStarts(idrFrames)
  
  return {
    recordTimeFramesPerSecond: wholeRecordTimeFramesPerSecond,
    startTimestamps: ObjectFromEntries(newTSs.map(
      ([framenr, parts]) => [framenr.toString(), partsToIsoDate(parts)])),
    iFrameInterval,
    iFrameStarts,
    idrFrameInterval,
    idrFrameStarts,
  }
}

export async function convert(
  input: {file: File},
  output: {dir: FileSystemDirectoryHandle},
  onProgress: (progress: FileTreeLeaf["progress"]) => void
) {

  const updateProgress = (step: "hash" | "timestamps" | "convert", progress: number) => {
    const DURATIONS: {[key in Parameters<typeof updateProgress>[0]]: number} = {
      hash: .1,
      timestamps: 1,
      convert: 1,
    }
    let sumProgress = 0
    for (const [key, value] of ObjectEntries(DURATIONS)) {
      if (key === step) {
        sumProgress += value * progress
        break
      }
      sumProgress += value
    }
    const sum = Object.values(DURATIONS).reduce((a, b) => a + b)
    onProgress({"converting": sumProgress / sum})
  }
  onProgress({"converting": 0})

  let outputfilename: string | undefined = undefined
  let outputstream: FileSystemWritableFileStream | undefined = undefined
  let video: Video | undefined = undefined
  let libav: LibAVTypes.LibAV | undefined = undefined

  try {
    const parts = input.file.name.split(".")
    const baseparts = parts.length == 1 ? parts : parts.slice(0, -1)
    const hash = await xxh64sum(input.file, progress => updateProgress(
      "hash", progress))
    outputfilename = [...baseparts, hash, "behave", "mp4"].join(".")
    const outfile = await output.dir.getFileHandle(outputfilename, {create: true})
    outputstream = await outfile.createWritable()

    video = new Video(input.file)
    await video.init({libavoptions: {noworker: false}, keepFrameInfo: true})
    const frameInfo = await video.getAllFrameInfo(progress => {
      updateProgress("timestamps", progress)
    })
    const compressedFrameInfo = getCompressedFrameInfo(frameInfo)
    const frameInfoJson = JSON.stringify(compressedFrameInfo)

    const durationSeconds = video.videoInfo.durationSeconds

    libav = await window.LibAV.LibAV({noworker: false, nothreads: true});
    await libav.mkreadaheadfile(input.file.name, input.file)
    await libav.mkwriterdev(outputfilename)
    await libav.mkstreamwriterdev(PROGRESSFILENAME)
    const writePromises: Set<Promise<unknown>> = new Set()
    let progressController = null as ReadableStreamDefaultController<ArrayBuffer> | null
    const progressStream = new ReadableStream({
      start(controller) {
        progressController = controller
      }
    }).pipeThrough(new TextDecoderStream())
    libav.onwrite = function(name, pos, data) {
      assert(progressController)
      if (name === PROGRESSFILENAME) {
        progressController.enqueue(data)
        return
      }
      const promise = outputstream!.write(
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
          if (key  === "out_time_us") {
            const outTimeSeconds = parseInt(value) / 1_000_000
            if (!Number.isNaN(outTimeSeconds)) {
              updateProgress("convert", 
                Math.max(0, Math.min(outTimeSeconds / durationSeconds, 1)))
            }
          }
        }
      }
    })))

    assert(/^[0-9a-fA-F]{16}$/.test(hash))
    const exit_code = await libav.ffmpeg(
      "-i", input.file.name,
      "-nostdin",
      "-c:v", "copy",
      "-an",
      "-hide_banner",
      "-loglevel", "error",
      "-movflags", "use_metadata_tags",
      "-metadata", "BEHAVE:frameInfo=" + frameInfoJson,
      "-metadata", "BEHAVE:playbackFps=" + video.videoInfo.fps.toString(),
      "-metadata", "BEHAVE:startTick=" + video.videoInfo.startTick.toString(),
      "-metadata", "BEHAVE:numberOfFrames=" + video.videoInfo.numberOfFramesInStream.toString(),
      "-metadata", "BEHAVE:hash=" + hash,
      "-progress", PROGRESSFILENAME,
      "-y", outputfilename
    )
    await Promise.all(writePromises)
    await libav.unlink(input.file.name)
    await libav.unlink(outputfilename)
    await libav.unlink(PROGRESSFILENAME)
    if (progressController) {
      progressController.close()
    }
    if (exit_code != 0) {
      throw new Error(`ffprobe exit code: ${exit_code}`)
    }
  } catch(e) {
    if (outputstream && outputfilename !== undefined) {
      await outputstream.close()
      await output.dir.removeEntry(outputfilename)
      throw e
    }
    outputfilename = undefined
    outputstream = undefined
  } finally {
    libav && libav.terminate()
    video && await video.deinit()
    if (outputstream) {
      await outputstream.close()
    }
  }
}
