import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'
import { parse as YAMLParse } from "yaml"

export type Detection = {
  klass: number
  cx: number
  cy: number
  width: number
  height: number
  confidence: number
}
export type Detections = {
  videoFileXXH64Sum: string
  totalNumberOfFrames: number
  modelName: string
  klasses: {[key: number]: string}
  detections: {[key: number]: Detection[]}
}

export const detectionsSlice = createSlice({
  name: "detections",
  initialState: null as null | Detections,
  reducers: {
    detectionsSet: (_state, action: PayloadAction<Detections>) => {
      return action.payload
    }
  }
})

export function createDetectionsFromLines(lines: Iterable<string> | Iterator<string, void, void>): Detections {
  if (Symbol.iterator in lines) {
    lines = lines[Symbol.iterator]()
  }
  if (lines.next().value !== "# version: 1") {
    throw new Error("Not a detection file")
  }
  const result: Partial<Detections> & Pick<Detections, "detections"> = {
    detections: {}
  }
  let iterResult
  while (!(iterResult = lines.next()).done) {
  const line = iterResult.value
    if (line.startsWith("# ")) {
      let parsed
      try {
        parsed = YAMLParse(line.slice("# ".length))
      } catch {
        continue;
      }
      if ("Model klasses" in parsed) {
        result.klasses = parsed["Model klasses"]
      }
      if ("Model name" in parsed) {
        result.modelName = parsed["Model name"]
      }
      if ("Source file xxHash64" in parsed) {
        result.videoFileXXH64Sum = parsed["Source file xxHash64"]
      }
      if ("Total number of frames" in parsed && Number.isInteger(parsed["Total number of frames"])) {
        result.totalNumberOfFrames = parsed["Total number of frames"] as number
        for (let i = 0; i < result.totalNumberOfFrames; i++) {
          result.detections[i] = []
        }
      }
    } else {
      const parts = line.split(",").map(parseFloat)
      if (parts.length !== 7 || parts.some(p => !Number.isFinite(p)) || [0, 1].some(i => !Number.isInteger(parts[i]))) {
        throw new Error(`Problem parsing line ${line}`)
      }
      const [framenr, klass, cx, cy, width, height, confidence] = parts
      if (result.detections[framenr] === undefined) {
        throw new Error(`Cannot find frame number ${framenr}`)
      }
      const detection = {klass, cx, cy, width, height, confidence}
      result.detections[framenr].push(detection)
    }
  }
  if (
    result.videoFileXXH64Sum === undefined
    || result.totalNumberOfFrames === undefined
    || result.modelName === undefined
    || result.klasses === undefined
  ) {
    throw new Error("Not all fields filled in")
  }
  return result as Detections
}


export default detectionsSlice.reducer

// export const selectOpfsFileCache = (state: RootState) => state.app.opfsFileCache
export const selectDetectionsPotentiallyNull = (state: RootState) => state.detections
export const selectDetectionsFileIsReady = (state: RootState): state is RootState & {detections: Detections} => {
  return state.detections !== null
}
export const selectDetections = (state: RootState): Detections => {
  if (!selectDetectionsFileIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.detections
}
