import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'

export type DetectionsDirectory = {
  directory: FileSystemDirectoryHandle
}

export const detectionsDirectorySlice = createSlice({
  name: "detectionsDirectory",
  initialState: null as null | DetectionsDirectory,
  reducers: {
    detectionsDirectorySet: (_state, action: PayloadAction<DetectionsDirectory>) => {
      return action.payload
    },
  }
})

export const {detectionsDirectorySet} = detectionsDirectorySlice.actions

export default detectionsDirectorySlice.reducer

export const selectDetectionsDirectoryPotentiallyNull = (state: RootState) => state.detectionsDirectory
export const selectDetectionsDirectoryIsReady = (state: RootState): state is RootState & {detectionsDirectory: DetectionsDirectory} => {
  return state.detectionsDirectory !== null
}
export const selectDetectionsDirectory = (state: RootState): DetectionsDirectory => {
  if (!selectDetectionsDirectoryIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.detectionsDirectory
}
