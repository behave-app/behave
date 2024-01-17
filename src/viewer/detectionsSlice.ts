import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'
import { DetectionInfo, getPartsFromTimestamp, } from '../lib/detections'
import { selectCurrentFrameNumber } from './videoPlayerSlice'

export type DetectionsDirectory = {
  directory: FileSystemDirectoryHandle
  detectionsByFilename: Record<string, FileSystemFileHandle[]>
}

export type DetectionsData = {
  directory: DetectionsDirectory | null
  detectionInfo: DetectionInfo | null
}

const initialState: DetectionsData = {
  directory: null,
  detectionInfo: null,
}

export const detectionsDirectorySlice = createSlice({
  name: "detections",
  initialState,
  reducers: {
    detectionsDirectorySet: (state, action: PayloadAction<DetectionsDirectory>) => {
      state.directory = action.payload
    },
    detectionsDirectoryUnset: (state) => {
      state.directory = null
    },
    detectionsInfoSet: (state, action: PayloadAction<DetectionInfo>) => {
      state.detectionInfo = action.payload
    },
    detectionsInfoUnset: (state) => {
      state.detectionInfo = null
    },
  }
})

export const {
  detectionsDirectorySet,
  detectionsDirectoryUnset,
  detectionsInfoSet,
  detectionsInfoUnset,
} = detectionsDirectorySlice.actions

export default detectionsDirectorySlice.reducer

export const selectDetectionsDirectoryPotentiallyNull = (state: RootState) => state.detections.directory
export const selectDetectionsDirectoryIsReady = (state: RootState): state is RootState & {detections: {directory: DetectionsDirectory}} => {
  return state.detections.directory !== null
}
export const selectDetectionsDirectory = (state: RootState): DetectionsDirectory => {
  if (!selectDetectionsDirectoryIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.detections.directory
}
export const selectDetectionInfo = (state: RootState) => state.detections.detectionInfo

export const selectDateTimes = createSelector(
  [selectDetectionInfo],
  (detectionInfo): null | ReturnType<typeof getPartsFromTimestamp>[] => {
    if (!detectionInfo) {
      return null
    }
    const frameInfosWithTs = detectionInfo.framesInfo
      .filter(frameInfo => "timestamp" in frameInfo)
      .map(frameInfo => ({
      ...frameInfo,
      timestampParts: getPartsFromTimestamp(frameInfo.timestamp!)
    }))
    if (frameInfosWithTs.length < 2) {
    console.warn("too few timestamps")
      return null
    }
    if (new Set(frameInfosWithTs
    .map(fi => fi.timestampParts.tz)).size !== 1) {
    console.warn("Not all items have same TZ")
      return null
    }
    let index = 0
    const p2 = (n: number) => n.toString().padStart(2, "0")
    const p4 = (n: number) => n.toString().padStart(4, "0")
    const calculateTimestamp = (pts: number): ReturnType<typeof getPartsFromTimestamp> => {
      const [start, end] = frameInfosWithTs.slice(index, index + 2)
      const pos = (pts - start.pts) / (end.pts - start.pts)
      if (pos > 1 && frameInfosWithTs.length > index + 2) {
        index++
        return calculateTimestamp(pts)
      }
      const ts = Math.round(
        (start.timestampParts.date.valueOf() + pos * (
          end.timestampParts.date.valueOf() - start.timestampParts.date.valueOf()
        )) / 1000) * 1000 + start.timestampParts.tzOffsetHours * 60 * 60 * 1000
      const date = new Date(ts)
      return {
        date,
        year: p4(date.getUTCFullYear()),
        month: p2(date.getUTCMonth() + 1),
        day: p2(date.getUTCDate()),
        hour: p2(date.getUTCHours()),
        minute: p2(date.getUTCMinutes()),
        second: p2(date.getUTCSeconds()),
        tz: start.timestampParts.tz,
        tzOffsetHours: start.timestampParts.tzOffsetHours,
      }
    }
    return detectionInfo.framesInfo.map(
      frameInfo => calculateTimestamp(frameInfo.pts))
  }
)

export const selectCurrentFrameDateTime = createSelector(
  [(state) => selectCurrentFrameNumber(state), selectDateTimes],
  (currentFrameNumber, datetimes) => {
    if (!datetimes) {
      return null
    }
    return datetimes[currentFrameNumber]
  }
)

export const selectCurrentFrameInfoPotentiallyNull = createSelector(
  // using delayed selector, because of circulair import
  [(state) => selectCurrentFrameNumber(state), selectDetectionInfo],
  (currentFrameNumber, detectionInfo) => {
    if (!detectionInfo) {
      return null
    }
    return detectionInfo.framesInfo[currentFrameNumber]
  }
)
export const selectCurrentFrameInfo = createSelector(
  // using delayed selector, because of circulair import
  [(state) => selectCurrentFrameNumber(state), selectDetectionInfo],
  (currentFrameNumber, detectionInfo) => {
    if (!detectionInfo) {
      throw new Error("Should not be called if detectionInfo can be null")
    }
    return detectionInfo.framesInfo[currentFrameNumber]
  }
)

export const selectFps = (_state: RootState) => 25 /// this should come from detectionInfo
export const selectOffset = (_state: RootState) => 0 /// this should come from detectionInfo
