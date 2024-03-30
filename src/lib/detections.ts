import { ArrayChecker, Checker, LiteralChecker, ObjectChecker, RecordChecker, StringChecker, UnionChecker, getCheckerFromObject } from "./typeCheck"

export type DetectionsForFrame = Array<{
      klass: number
      cx: number
      cy: number
      width: number
      height: number
      confidence: number
  }>

export type ISODateTimeString = `isodate:${number}-${number}-${number}T${number}:${number}:${number}${"Z" | `${"+" | "-"}${number}${":" |""}${number}`}`
const ISODATETIMESTRINGREGEX = /^isodate:(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?<tz>Z|(?<tzSign>[+-])(?<tzHours>\d{2}):?(?<tzMinutes>\d{2}))$/

export type SingleFrameInfo = {
  pts: number
  dts: number
  type: "I" | "IDR" | "P" | "B"
  detections: DetectionsForFrame
  timestamp?: ISODateTimeString
  startByte?: number
}

export type SingleFrameInfoV2 = {
  detections: DetectionsForFrame
}

export type FramesInfo = Array<SingleFrameInfo>
export type FramesInfoV2 = Array<SingleFrameInfoV2>

type NumberString = `${number}`

export type DetectionInfo = {
  version: 1
  totalNumberOfFrames: number
  sourceFileName: string
  sourceFileXxHash64: string
  modelName: string | null
  modelKlasses: Record<NumberString, string>
  playbackFps: number
  recordFps: number | null
  framesInfo: FramesInfo
}

export type DetectionInfoV2 = {
  version: 2
  sourceFileName: string
  sourceFileXxHash64: string
  modelName: string | null
  modelKlasses: Record<NumberString, string>
  framesInfo: FramesInfoV2
}

export function detectionInfoToString(
  detectionInfo: DetectionInfo | DetectionInfoV2): string {
  return JSON.stringify(
    detectionInfo,
    (_key, x) => Number.isFinite(x) ? Math.fround(x * 10000) / 10000: x,
    4)
}

export function validateDataIsDetectionInfo(data: unknown): data is DetectionInfo | DetectionInfoV2 {
  const framesInfoCheck: Checker<SingleFrameInfo> = new ObjectChecker({
    required: {
      pts: 0,
      dts: 0,
      type: new LiteralChecker(["I", "IDR", "P", "B"]),
      detections: new ArrayChecker({
        klass: 0, cx: 0, cy: 0, width: 0, height: 0, confidence: 0}),
    },
    optional: {
        timestamp: new StringChecker({regexp: ISODATETIMESTRINGREGEX}) as Checker<ISODateTimeString>,
        startByte: 0
    }
  })

  const framesInfoV2Check: Checker<SingleFrameInfoV2> = getCheckerFromObject({
      detections: new ArrayChecker({
        klass: 0, cx: 0, cy: 0, width: 0, height: 0, confidence: 0}),
  })

  const detectionDataFormat: Checker<DetectionInfo> = getCheckerFromObject({
    totalNumberOfFrames: 0,
    version: new LiteralChecker(1),
    sourceFileName: "name",
    sourceFileXxHash64: "hash",
    modelName: new UnionChecker(["name", null]),
    modelKlasses: new RecordChecker({
      keyChecker: new StringChecker({regexp: /^([1-9][0-9]*)|0$/}),
      valueChecker: new StringChecker(),
    }),
    playbackFps: 0,
    recordFps: new UnionChecker([0, null]),
    framesInfo: new ArrayChecker(framesInfoCheck), 
  })

  const detectionDataV2Format: Checker<DetectionInfoV2> = getCheckerFromObject({
    version: new LiteralChecker(2),
    sourceFileName: "name",
    sourceFileXxHash64: "hash",
    modelName: new UnionChecker(["name", null]),
    modelKlasses: new RecordChecker({
      keyChecker: new StringChecker({regexp: /^([1-9][0-9]*)|0$/}),
      valueChecker: new StringChecker(),
    }),
    framesInfo: new ArrayChecker(framesInfoV2Check), 
  })

  return (new UnionChecker([detectionDataFormat, detectionDataV2Format]).isInstance(
    data))
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

export function formatDateTimeParts(parts: DateTimeParts, format: string): string {
  return format.replaceAll(/%./g, match => {
    switch (match) {
      case "%Y": return parts.year
      case "%m": return parts.month
      case "%d": return parts.day
      case "%H": return parts.hour
      case "%M": return parts.minute
      case "%S": return parts.second
      case "%%": return "%"
      default:
        throw new Error(`Unknown format: ${match}`)
    }
  })
}

export function partsToIsoDate(parts: DateTimeParts): ISODateTimeString {
  return "isodate:" + formatDateTimeParts(parts, "%Y-%m-%dT%H:%M:%S") + parts.tz as ISODateTimeString
}
