import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'
import { DetectionInfo } from './detections'

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

export const selectDetectionsByFrameNumber = (state: RootState) => {
  if (!state.detections.detectionInfo) {
    throw new Error("Should not be called if detectionInfo can be null")
  }
  return state.detections.detectionInfo.detections
}

export const selectFps = (_state: RootState) => 25 /// this should come from detectionInfo
export const selectOffset = (_state: RootState) => 0 /// this should come from detectionInfo
