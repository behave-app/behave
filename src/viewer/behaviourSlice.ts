import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'

export type Detect = {
  file: File
  xxh64sum: string
}

export const videoFileSlice = createSlice({
  name: "behaviour",
  initialState: {
    syncToFile: null as null | WritableStream,
  },
  reducers: {
    syncToFileSet: (_state, action: PayloadAction<VideoFile>) => {
      return action.payload
    },
  }
})

export const {videoFileSet} = videoFileSlice.actions

export default videoFileSlice.reducer

export const selectVideoFilePotentiallyNull = (state: RootState) => state.videoFile
export const selectVideoFileIsReady = (state: RootState): state is RootState & {videoFile: VideoFile} => {
  return state.videoFile !== null
}
export const selectVideoFile = (state: RootState): VideoFile => {
  if (!selectVideoFileIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.videoFile
}
