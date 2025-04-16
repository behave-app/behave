import { createAsyncThunk } from '@reduxjs/toolkit'
import type { RootState, } from './store'
import { selectDetectionInfoPotentiallyNull, } from './detectionsSlice'
import { selectConfidenceCutoffByClass, selectCurrentFrameNumber } from './selectors'
import { assert, clampedAt } from '../lib/util'
import { PLAYBACK_RATES, selectPlaybackRate } from './videoPlayerSlice'
import { selectDefaultOffset, selectAvgFps, selectExactPtsInSeconds_s, selectMetadata} from './videoFileSlice'

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


export const videoPlay = createAsyncThunk<void>("videoPlayer/videoPlay", async (_, {getState}): Promise<void> => {
  const video = selectVideoPlayerElement(getState() as RootState)
  return video.play()
})


export const videoPause = createAsyncThunk("videoPlayer/videoPause", async (_, {getState}): Promise<void> => {
  const video = selectVideoPlayerElement(getState() as RootState)
  return video.pause()
})

export const videoTogglePlayPause = createAsyncThunk("videoPlayer/videoTogglePlayPause", async (_, {getState}): Promise<void> => {
  const video = selectVideoPlayerElement(getState() as RootState)
  return video.paused ? video.play() : video.pause()
})

export const videoSeekToFrameNumberAndPause = createAsyncThunk("videoPlayer/videoSeekToFrameNumberAndPause", 
  async (frameNumber: number, {getState}
  ): Promise<void> => {
    const state = getState() as RootState
    const video = selectVideoPlayerElement(state)
    const avgFps = selectAvgFps(state)
    const exactPtsInSeconds_s = selectExactPtsInSeconds_s(state)
    if (avgFps === null || exactPtsInSeconds_s === null) {
      console.warn("Don't have enough data to seek")
      return
    }
    const offset = selectDefaultOffset(state)
    video.pause()
    if (exactPtsInSeconds_s === "N/A") {
      video.currentTime = (frameNumber - offset) / avgFps
    } else {
      video.currentTime = (
        clampedAt(exactPtsInSeconds_s, frameNumber - offset) + 
          clampedAt(exactPtsInSeconds_s, frameNumber - offset + 1)
      ) / 2
    }
  })

export const videoSeekToFrameNumberDiffAndPause = createAsyncThunk("videoPlayer/videoSeekToFrameNumberDiffAndPause", 
  async (frameNumberDiff: number, {getState, dispatch}
  ): Promise<void> => {
    const currentFrameNumber = selectCurrentFrameNumber(getState() as RootState)
    assert(currentFrameNumber !== null)
    await dispatch(videoSeekToFrameNumberAndPause(
      currentFrameNumber + frameNumberDiff))
  })

export const videoChangePlaybackRate = createAsyncThunk("videoPlayer/videoChangePlaybackRate", 
  async (rate: number, {getState}
  ): Promise<void> => {
    const video = selectVideoPlayerElement(getState() as RootState)
    video.playbackRate = rate
  })

export const videoChangePlaybackRateOneStep = createAsyncThunk("videoPlayer/videoChangePlaybackRateOneStep", 
  async (change: "slower" | "faster", {getState, dispatch}
  ): Promise<void> => {
    const state = getState() as RootState
    const playbackRate = selectPlaybackRate(state)
    assert(playbackRate !== null)
    let playbackRateIndex = PLAYBACK_RATES.indexOf(playbackRate)
    if (playbackRateIndex === -1) {
      playbackRateIndex = PLAYBACK_RATES.indexOf(1)
    }
    const newPlaybackRateIndex = playbackRateIndex + (change === "slower" ? -1 : 1)
    const newPlaybackRate = PLAYBACK_RATES[
      Math.max(0, Math.min(PLAYBACK_RATES.length - 1, newPlaybackRateIndex))]
    await dispatch(videoChangePlaybackRate(newPlaybackRate))
  })

export const videoSeekToNextDetectionAndPause = createAsyncThunk("videoPlayer/videoSeekToNextDetectionAndPause", 
  async (direction: "forwards" | "backwards", {getState, dispatch}
  ): Promise<void> => {
    const state = getState() as RootState
    const detectionInfo = selectDetectionInfoPotentiallyNull(state)
    const metadata = selectMetadata(state)
    const confidenceCutoffByClass = selectConfidenceCutoffByClass(state)
    const currentFrameNumber = selectCurrentFrameNumber(getState() as RootState)
    if (!detectionInfo || currentFrameNumber === null || confidenceCutoffByClass === null || !metadata) {
      return
    }
    const [searchIn, offset] = direction === "backwards"
      ? [detectionInfo.framesInfo.slice(0, currentFrameNumber), 0]
      : [detectionInfo.framesInfo.slice(currentFrameNumber + 1),
        currentFrameNumber + 1]
    const functionName = direction === "backwards" ? "findLastIndex" : "findIndex"
    let newFrameNumber = searchIn[functionName](
      frameInfo =>  frameInfo && frameInfo.detections.some(
        d => d.confidence >= confidenceCutoffByClass.get(`${d.klass}`)!),
    )
    if (newFrameNumber === -1) {
      newFrameNumber = direction === "backwards" ? 0 : metadata.numberOfFrames
    } else {
      newFrameNumber = newFrameNumber + offset
    }
    await dispatch(videoSeekToFrameNumberAndPause(newFrameNumber))
  })
