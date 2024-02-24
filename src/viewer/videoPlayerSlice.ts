import type { RootState, } from './store'
import { assert } from '../lib/util'

import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit'

export const createAppSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
})

export const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1, 2, 5]
assert(JSON.stringify(PLAYBACK_RATES) === JSON.stringify(
  PLAYBACK_RATES.toSorted((a, b) => a - b)), "PLAYBACK_RATES must be sorted")

export type PlayerState = Readonly<{
  currentTime: number
  duration: number
  ended: boolean
  error: MediaError | null
  paused: boolean
  playbackRate: number
  seeking: boolean
  videoWidth: number,
  videoHeight: number,
}>

type VideoPlayerSettings = {
  playerState: null | PlayerState
  videoPlayerElementId: null | string
};


export const videoPlayerSlice = createAppSlice({
  name: "videoPlayer",
  initialState: {
    playerState: null,
    videoPlayerElementId: null,
  } as VideoPlayerSettings,
  reducers: create => ({
    playerStateSet: create.reducer<PlayerState | null>((state, action) => {
      // note: there seems to be no downside to always just copying out everything
      // from the video object
      state.playerState = action.payload
    }),
    videoPlayerElementIdSet: create.reducer<string | null>((state, action) => {
      state.videoPlayerElementId = action.payload
    }),
  }),
})

export const {
  playerStateSet,
  videoPlayerElementIdSet,
} = videoPlayerSlice.actions

export default videoPlayerSlice.reducer

export const selectPlayerState = (state: RootState) => state.videoPlayer.playerState

export const selectVideoAspect = (state: RootState) => {
  const width = state.videoPlayer.playerState?.videoWidth
  const height = state.videoPlayer.playerState?.videoHeight
  if (width === undefined || height === undefined || height === 0) {
    return null
  }
  return width / height
}

export const selectCurrentTime = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.currentTime
}

export const selectDuration = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.duration
}

export const selectEnded = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.ended
}

export const selectError = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.error
}

export const selectPaused = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.paused
}

export const selectPlaybackRate = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.playbackRate
}

export const selectSeeking = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    return null
  }
  return state.videoPlayer.playerState.seeking
}
