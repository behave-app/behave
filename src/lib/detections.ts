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
  if (typeof data !== "object" || data === null) {
    return false; // Not an object
  }

  const {
    version,
    totalNumberOfFrames,
    sourceFileName,
    sourceFileXxHash64,
    modelName,
    modelKlasses,
    playbackFps,
    recordFps,
    framesInfo,
  } = data as Partial<DetectionInfo>;

  // Check if required properties are present and have the correct types
  if (
    typeof version !== "number" ||
    typeof totalNumberOfFrames !== "number" ||
    totalNumberOfFrames < 0 ||
    typeof sourceFileName !== "string" ||
    typeof sourceFileXxHash64 !== "string" ||
    typeof modelName !== "string" ||
    typeof modelKlasses !== "object" ||
    typeof playbackFps !== "number" ||
    (recordFps !== null && typeof recordFps !== "number") ||
    !Array.isArray(framesInfo)
  ) {
    console.log("Validation failed: Invalid properties");
    return false;
  }

  // Check modelKlasses values
  for (const key in modelKlasses) {
    if (typeof key !== "string" || !/^([1-9][0-9]*)|0/.test(key) || typeof modelKlasses[key as NumberString] !== "string") {
      console.log("Validation failed: Invalid modelKlasses");
      return false;
    }
  }

  // Check framesInfo structure
  for (const frame of framesInfo) {
    if (
      typeof frame.pts !== "number" ||
      typeof frame.dts !== "number" ||
      !["I", "IDR", "P", "B"].includes(frame.type) ||
      !Array.isArray(frame.detections) ||
      frame.detections.some(
            (detection) =>
              typeof detection.klass !== "number" ||
              typeof detection.cx !== "number" ||
              typeof detection.cy !== "number" ||
              typeof detection.width !== "number" ||
              typeof detection.height !== "number" ||
              typeof detection.confidence !== "number"
      ) ||
      (frame.timestamp !== undefined && !(
          ISODATETIMESTRINGREGEX.test(frame.timestamp))) ||
      (frame.startByte !== undefined && typeof frame.startByte !== "number")
    ) {
      console.log("Validation failed: Invalid framesInfo", frame);
      return false;
    }
  }

  return true; // Passed all checks, it's a valid DetectionInfo
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
