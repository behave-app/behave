import { range, readLines } from "src/lib/util"

export type DetectionsForFrame = Array<{
      klass: number
      cx: number
      cy: number
      width: number
      height: number
      confidence: number
  }>
export type Detections = DetectionsForFrame[]

export type DetectionInfo = {
  version: 1
  totalNumberOfFrames: number
  sourceFileName: string
  sourceFileXxHash64: string
  modelName: string
  modelKlasses: Record<number, string>
  // timestamps: Timestamps
  // firstIFrameFrameNumber: number
  detections: Detections
}

const error = Symbol()

const DETECTION_INFO_MAP: {[K in keyof Omit<DetectionInfo, "detections"> as string]: readonly [
  K,
  (s: string) => DetectionInfo[K] | typeof error,
]} = {
  "version": ["version", s => s === "1" ? 1 : error],
  "Total number of frames": ["totalNumberOfFrames",
      s => /^ *([1-9][0-9]+|0)$/.test(s) ? parseInt(s) : error],
  "Source file name": ["sourceFileName", s => s],
  "Source file xxHash64": ["sourceFileXxHash64",
      s => /^[0-9a-f]{16}$/.test(s) ? s : error],
  "Model name": ["modelName", s => s],
  "Model klasses": ["modelKlasses", s => Object.fromEntries(
      Object.entries(JSON.parse(s) as Record<string, string>)
        .map(([k, v]) => [parseInt(k), v]))]
  // timestamps: Timestamps
  // firstIFrameFrameNumber: number
} as const

export async function detectionInfoFromFile(
  file: File
): Promise<DetectionInfo | null> {
  const detections: Record<number, DetectionsForFrame> = {}
  const info: Partial<DetectionInfo> = {}
  for await(const line of readLines(file)) {
    if (line.length === 0) {
      continue
    }
    if (line[0] === "#") {
      const colonPos = line.indexOf(": ")
      if (colonPos !== -1) {
        const key = line.slice(1, colonPos).trim()
        const value = line.slice(colonPos + 2)
        if (key in DETECTION_INFO_MAP) {
          const [detectionInfoKey, convertor] = DETECTION_INFO_MAP[key]
          const detectionInfoValue = convertor(value)
          if (detectionInfoValue === error) {
            return null
          }
          // too much magic
          (info[detectionInfoKey] as unknown) = detectionInfoValue
        }
      }
      continue
    }
    const parts = line.split(",")
    if (parts.length !== 7) {
      return null
    }
    const [frameNr, klass] = parts.slice(0, 2).map(i => parseInt(i))
    const [cx, cy, width, height, confidence] = parts.slice(2).map(f => parseFloat(f))
    detections[frameNr] = [
      ...(detections[frameNr] ?? []),
      {klass, cx, cy, width, height, confidence}
    ]
  }
  if (!(Object.values(DETECTION_INFO_MAP).every(([key]) => key in info))) {
    return null
  }
  info.detections = range(info.totalNumberOfFrames!).map(
    index => detections[index] ?? [])
  return info as DetectionInfo
}
