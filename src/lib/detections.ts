import { ArrayChecker, Checker, LiteralChecker, ObjectChecker, RecordChecker, StringChecker, getCheckerFromObject } from "./typeCheck"

export type DetectionsForFrame = Array<{
      klass: number
      cx: number
      cy: number
      width: number
      height: number
      confidence: number
  }>

type ISODateTimeString = `isodate:${number}-${number}-${number}T${number}:${number}:${number}${"Z" | `${"+" | "-"}${number}${":" |""}${number}`}`
const ISODATETIMESTRINGREGEX = /^isodate:(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?<tz>Z|(?<tzSign>[+-])(?<tzHours>\d{2}):?(?<tzMinutes>\d{2}))$/

export type SingleFrameInfo = {
  pts: number
  dts: number
  type: "I" | "IDR" | "P" | "B"
  detections: DetectionsForFrame
  timestamp?: ISODateTimeString
  startByte?: number
}

export type FramesInfo = Array<SingleFrameInfo>

type NumberString = `${number}`

export type DetectionInfo = {
  version: 1
  totalNumberOfFrames: number
  sourceFileName: string
  sourceFileXxHash64: string
  modelName: string
  modelKlasses: Record<NumberString, string>
  playbackFps: number
  recordFps: number | null
  framesInfo: FramesInfo
}

export function detectionInfoToString(detectionInfo: DetectionInfo): string {
  return JSON.stringify(detectionInfo)
}

function validateDataIsDetectionInfo(data: unknown): data is DetectionInfo {
  const framesInfoCheck: Checker<SingleFrameInfo> = new ObjectChecker({
    required: {
      pts: 0,
      dts: 0,
      type: new LiteralChecker(["I", "IDR", "P", "B"]),
      detections: new ArrayChecker({
        klass: 0, cx: 0, cy: 0, width: 0, height: 0, confidence: 0}),
    },
    optional: {
        timestamp: new StringChecker({valid: s => ISODATETIMESTRINGREGEX.test(s)}) as Checker<ISODateTimeString>,
        startByte: 0
    }
  })

  const detectionDataFormat = getCheckerFromObject({
    totalNumberOfFrames: 0,
    version: new LiteralChecker(1),
    sourceFileName: "name",
    sourceFileXxHash64: "hash",
    modelName: "name",
    modelKlasses: new RecordChecker({
      keyChecker: new StringChecker({regexp: /^([1-9][0-9]*)|0$/}),
      valueChecker: new StringChecker(),
    }),
    playbackFps: 0,
    recordFps: null,
    framesInfo: new ArrayChecker(framesInfoCheck),
  })

  return (detectionDataFormat.isInstance(data))
}

export function stringToDetectionInfo(data: string): null | DetectionInfo {
  const detectionInfo = JSON.parse(data)
  if (!validateDataIsDetectionInfo(detectionInfo)) {
    return null
  }
  return detectionInfo
}
export type DateTimeParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
  tz: string
  date: Date,
  tzOffsetHours: number
}
export function getPartsFromTimestamp(
  ts: NonNullable<SingleFrameInfo["timestamp"]>
): DateTimeParts {
  const match = ts.match(ISODATETIMESTRINGREGEX)
  if (!match || !match.groups) {
    throw new Error("No timestamp: " + ts)
  }
  const dateInfo = {
    year: match.groups.year,
    month: match.groups.month,
    day: match.groups.day,
    hour: match.groups.hour,
    minute: match.groups.minute,
    second: match.groups.second,
    tz: match.groups.tz,
  }
  const tzOffsetHours = dateInfo.tz === "Z" ? 0
  : {"+": 1, "-": -1}[match.groups.tzSign]! * (parseInt(match.groups.tzHours) + parseInt(match.groups.tzMinutes) / 60)
  return {
    ...dateInfo,
    date: new Date(Date.parse(ts.slice("isodate:".length))),
    tzOffsetHours,
  }
}
