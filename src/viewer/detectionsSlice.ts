import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { DetectionInfo } from '../lib/detections'

export type DetectionsData = {
  detectionFileName: string | null
  detectionInfo: DetectionInfo | null
}

const initialState: DetectionsData = {
  detectionFileName: null,
  detectionInfo: null,
}

export const detectionsDirectorySlice = createSlice({
  name: "detections",
  initialState,
  reducers: {
    detectionFileNameSet: (state, {payload}: PayloadAction<string | null>) => {
      state.detectionFileName = payload},
    detectionsInfoSet: (state, action: PayloadAction<DetectionInfo>) => {
      state.detectionInfo = action.payload
    },
    detectionsInfoUnset: (state) => {
      state.detectionInfo = null
    },
  }
})

export const {
  detectionsInfoSet,
  detectionsInfoUnset,
  detectionFileNameSet,
} = detectionsDirectorySlice.actions

export default detectionsDirectorySlice.reducer

export const selectDetectionInfoPotentiallyNull = (state: RootState) => state.detections.detectionInfo

export const selectDetectionFilename = (state: RootState) => state.detections.detectionFileName

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
