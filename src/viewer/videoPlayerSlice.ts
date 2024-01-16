import { createSelector } from '@reduxjs/toolkit'
import { RootState, } from './store'
import { selectDetectionInfo, selectFps, selectOffset } from './detectionsSlice'
import { assert } from 'src/lib/util'

import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit'
import { selectConfidenceCutoff } from './settingsSlice'

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
    videoPlay: create.asyncThunk<void>(async (_, {getState}): Promise<void> => {
      const video = selectVideoPlayerElement(getState() as RootState)
      return video.play()
    }),
    videoPause: create.asyncThunk<void>(async (_, {getState}): Promise<void> => {
      const video = selectVideoPlayerElement(getState() as RootState)
      return video.pause()
    }),
    videoTogglePlayPause: create.asyncThunk<void>(async (_, {getState}): Promise<void> => {
      const video = selectVideoPlayerElement(getState() as RootState)
      return video.paused ? video.play() : video.pause()
    }),
    videoSeekToFrameNumberAndPause: create.asyncThunk<number>(
      async (frameNumber, {getState}
      ): Promise<void> => {
        const state = getState() as RootState
        const video = selectVideoPlayerElement(state)
        const fps = selectFps(state)
        const offset = selectOffset(state)
        video.pause()
        video.currentTime = (frameNumber - offset) / fps
      }),
    videoSeekToFrameNumberDiffAndPause: create.asyncThunk<number>(
      async (frameNumberDiff, {getState, dispatch}
      ): Promise<void> => {
        const currentFrameNumber = selectCurrentFrameNumber(getState() as RootState)
        await dispatch(videoSeekToFrameNumberAndPause(
          currentFrameNumber + frameNumberDiff))
      }),
    videoChangePlaybackRate: create.asyncThunk<number>(
      async (rate, {getState}
      ): Promise<void> => {
        const video = selectVideoPlayerElement(getState() as RootState)
        video.playbackRate = rate
      }),
    videoChangePlaybackRateOneStep: create.asyncThunk<boolean>(
      async (changeToSlower, {getState, dispatch}
      ): Promise<void> => {
        const state = getState() as RootState
        const playbackRate = selectPlaybackRate(state)
        let playbackRateIndex = PLAYBACK_RATES.indexOf(playbackRate)
        if (playbackRateIndex === -1) {
          playbackRateIndex = PLAYBACK_RATES.indexOf(1)
        }
        const newPlaybackRateIndex = playbackRateIndex + (changeToSlower ? -1 : 1)
        const newPlaybackRate = PLAYBACK_RATES[
          Math.max(0, Math.min(PLAYBACK_RATES.length - 1, newPlaybackRateIndex))]
        await dispatch(videoChangePlaybackRate(newPlaybackRate))
      }),
    videoSeekToNextDetectionAndPause: create.asyncThunk<boolean>(
      async (searchBackwards, {getState, dispatch}
      ): Promise<void> => {
        const state = getState() as RootState
        const detectionInfo = selectDetectionInfo(state)
        const confidenceCutoff = selectConfidenceCutoff(state)
        if (!detectionInfo) {
          return
        }
        const currentFrameNumber = selectCurrentFrameNumber(getState() as RootState)
        const [searchIn, offset] = searchBackwards
          ? [detectionInfo.framesInfo.slice(0, currentFrameNumber), 0]
          : [detectionInfo.framesInfo.slice(currentFrameNumber + 1),
            currentFrameNumber + 1]
        const functionName = searchBackwards ? "findLastIndex" : "findIndex"
        let newFrameNumber = searchIn[functionName](
          frameInfo => frameInfo.detections.some(
            d => d.confidence >= confidenceCutoff),
        )
        if (newFrameNumber === -1) {
          newFrameNumber = searchBackwards ? 0 : detectionInfo.totalNumberOfFrames
        } else {
          newFrameNumber = newFrameNumber + offset
        }
        await dispatch(videoSeekToFrameNumberAndPause(newFrameNumber))
      }),
  }),
})

export const {
  playerStateSet,
  videoPlayerElementIdSet,
  videoPlay,
  videoPause,
  videoTogglePlayPause,
  videoSeekToFrameNumberAndPause,
  videoSeekToFrameNumberDiffAndPause,
  videoChangePlaybackRate,
  videoChangePlaybackRateOneStep,
  videoSeekToNextDetectionAndPause,
} = videoPlayerSlice.actions

export default videoPlayerSlice.reducer

export const selectPlayerState = (state: RootState) => state.videoPlayer.playerState

// Warning: DO NOT EXPORT -- because people might be temped to keep a reference to the element itself
const selectVideoPlayerElementId = (state: RootState) => state.videoPlayer.videoPlayerElementId
const selectVideoPlayerElement = (state: RootState): HTMLVideoElement => {
  const id = selectVideoPlayerElementId(state)
  if (id === null) {
    throw new Error("No video element id")
  }
  const el = document.getElementById(id)
  if (!el) {
    throw new Error("No video element for id: " + id)
  }
  if (el.tagName.toUpperCase() !== "VIDEO") {
    throw new Error(`Element for id ${id} has type ${el.tagName}`)
  }
  return el as HTMLVideoElement
}


export const selectCurrentTime = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve currentTime from null state")
  }
  return state.videoPlayer.playerState.currentTime
}

export const selectDuration = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve duration from null state")
  }
  return state.videoPlayer.playerState.duration
}

export const selectEnded = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve ended from null state")
  }
  return state.videoPlayer.playerState.ended
}

export const selectError = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve error from null state")
  }
  return state.videoPlayer.playerState.error
}

export const selectPaused = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve paused from null state")
  }
  return state.videoPlayer.playerState.paused
}

export const selectPlaybackRate = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve playbackRate from null state")
  }
  return state.videoPlayer.playerState.playbackRate
}

export const selectSeeking = (state: RootState) => {
  if (state.videoPlayer.playerState === null) {
    throw new Error("Trying to retrieve seeking from null state")
  }
  return state.videoPlayer.playerState.seeking
}

export const selectCurrentFrameNumber = createSelector(
  [selectCurrentTime, selectFps, selectOffset],
  (currentTime, fps, offset) => Math.round(currentTime * fps) + offset
)

export const selectDurationInFrames = createSelector(
  [selectDuration, selectFps, selectOffset],
  (duration, fps, offset) => Math.round(duration * fps) + offset
)
