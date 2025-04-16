import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { VideoMetadata } from '../lib/video-shared';
import { API } from '../worker/Api';

export type VideoFile = {
  file: File
  metadata: VideoMetadata
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

export async function createSliceDataFromFile(file: File): Promise<VideoFile> {
  const metadata = await API.extractMetadata(file)
  return {file, metadata}
}

export const selectMetadata = (state: RootState): VideoMetadata | null => {
  return state.videoFile?.metadata ?? null
}

export const selectAvgFps = (state: RootState) => {
  const metadata = selectMetadata(state)
  return metadata?.avgPlaybackFps ?? null
}

export const selectExactPtsInSeconds_s = (state: RootState) => {
  const metadata = selectMetadata(state)
  return metadata?.exactPtsInSeconds_s ?? null
}

/**
 * Offest is the difference between the first frame shown in the <video> player
 * (postion=0) and the first frame in the detectionInfo
 *
 * It seems that for MTS files, the offset is the index of the first I frame or IDR frame
 */
export const selectDefaultOffset = createSelector(
  [selectMetadata], (metadata) => {
    if (!metadata) {
      return NaN
    }
    return metadata.frameTypeInfo?.iFrameStarts[0] ?? 0
  })
