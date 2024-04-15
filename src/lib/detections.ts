import { ArrayChecker, Checker, LiteralChecker, ObjectChecker, RecordChecker, StringChecker, UnionChecker, } from "./typeCheck"
import { ISODATETIMESTRINGREGEX, ISODateTimeString } from "./datetime"

export type DetectionsForFrame = Array<{
      klass: number
      cx: number
      cy: number
      width: number
      height: number
      confidence: number
  }>

export type SingleFrameInfo = {
  detections: DetectionsForFrame
}

export type FramesInfo = Array<SingleFrameInfo | null>

type NumberString = `${number}`

export type DetectionInfo = {
  version: 1
  sourceFileName: string
  sourceFileXxHash64: string
  modelName: string | null
  modelKlasses: Record<NumberString, string>
  framesInfo: FramesInfo
}

export function detectionInfoToString(
  detectionInfo: DetectionInfo): string {
  return JSON.stringify(
    detectionInfo,
    (_key, x) => Number.isFinite(x) ? Math.fround(x * 10000) / 10000: x,
    4)
}

export function validateDataIsDetectionInfo(data: unknown): data is DetectionInfo {
  const framesInfoCheck: Checker<SingleFrameInfo | null> = new UnionChecker([
  new ObjectChecker({
    required: {
      detections: new ArrayChecker({
        klass: 0, cx: 0, cy: 0, width: 0, height: 0, confidence: 0}),
    },
    optional: {
      timestamp: new StringChecker({regexp: ISODATETIMESTRINGREGEX}) as Checker<ISODateTimeString>,
      startByte: 0,
      pts: 0,
      dts: 0,
      type: new LiteralChecker(["I", "IDR", "P", "B"]),
    }
  }), null])

  const detectionDataFormat: Checker<DetectionInfo> = new ObjectChecker({
    required: {
      version: new LiteralChecker(1),
      sourceFileName: "name",
      sourceFileXxHash64: "hash",
      modelName: new UnionChecker(["name", null]),
      modelKlasses: new RecordChecker({
        keyChecker: new StringChecker({regexp: /^([1-9][0-9]*)|0$/}),
        valueChecker: new StringChecker(),
      }),
      framesInfo: new ArrayChecker(framesInfoCheck), 
    }, optional: {
      totalNumberOfFrames: 0,
      playbackFps: 0,
      recordFps: new UnionChecker([0, null]),
    }})


  return detectionDataFormat.isInstance(data)
}

