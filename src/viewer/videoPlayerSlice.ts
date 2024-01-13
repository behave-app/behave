import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'
import { selectFps, selectOffset } from './detectionsSlice'

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


export const videoPlayerSlice = createSlice({
  name: "videoPlayer",
  initialState: {
    playerState: null,
    videoPlayerElementId: null,
  } as VideoPlayerSettings,
  reducers: {
    playerStateSet: (state, action: PayloadAction<PlayerState | null>) => {
      // note: there seems to be no downside to always just copying out everything
      // from the video object
      state.playerState = action.payload
    },
    videoPlayerElementIdSet: (state, action: PayloadAction<string | null>) => {
      state.videoPlayerElementId = action.payload
    },
  }
})

export const {playerStateSet, videoPlayerElementIdSet} = videoPlayerSlice.actions

export default videoPlayerSlice.reducer

export const selectPlayerState = (state: RootState) => state.videoPlayer.playerState

// Warning: DO NOT EXPORT -- because people might be temped to keep a reference to the element itself
const selectVideoPlayerElementId = (state: RootState) => state.videoPlayer.videoPlayerElementId

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

export const selectPlaybackControls = createSelector(
  [selectVideoPlayerElementId, selectFps, selectOffset],
  (id, fps, offset) => {
    function getVid(): HTMLVideoElement {
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

    return {
      play: () => getVid().play(),
      pause: () => getVid().pause(),
      togglePlayPause: () => {
        const vid = getVid()
        return vid.paused ? vid.play() : vid.pause()
      },
      seekToFrameNumber: (frameNumber: number) => {
        const vid = getVid()
        vid.currentTime = (frameNumber - offset) / fps
      },
      seekByFrameNumberDiff: (frameNumber: number) => {
        const vid = getVid()
        vid.currentTime += frameNumber * fps
      },
      changePlaybackRate: (rate: number) => {
        getVid().playbackRate = rate
      }
    }
  }
)

