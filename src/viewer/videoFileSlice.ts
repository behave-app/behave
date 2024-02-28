import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'

export type VideoFile = {
  file: File
  xxh64sum: string
}

export const videoFileSlice = createSlice({
  name: "videoFile",
  initialState: null as null | VideoFile,
  reducers: {
    videoFileSet: (_state, action: PayloadAction<VideoFile>) => {
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

export const selectVideoUrl = createSelector(
  [selectVideoFilePotentiallyNull],
  videoFile => videoFile === null ? null : URL.createObjectURL(videoFile.file)
)
