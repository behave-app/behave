import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { DetectionInfo } from '../lib/detections'

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
export const selectDetectionsDirectoryAssertNotNull = (state: RootState): DetectionsDirectory => {
  if (!selectDetectionsDirectoryIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.detections.directory
}
export const selectDetectionInfoPotentiallyNull = (state: RootState) => state.detections.detectionInfo

export const selectFps = (state: RootState) => {
  const detectionInfo = selectDetectionInfoPotentiallyNull(state)
  if (!detectionInfo) {
    return NaN
  }
  return detectionInfo.playbackFps
}

export const selectOffset = createSelector(
  [selectDetectionInfoPotentiallyNull], (detectionInfo) => {
    if (!detectionInfo) {
      return NaN
    }
    const firstIframe = detectionInfo.framesInfo.findIndex(
      fi => fi.type === "I" || fi.type === "IDR")
    if (firstIframe === -1) {
      return NaN
    }
    return firstIframe
  })
