import { useState, useEffect } from 'preact/hooks';

type UseVideoPlayerReturnType = {
  playerState: PlayerState,
  setVideo: (video: HTMLVideoElement | null) => void,
  video: HTMLVideoElement | null
};

export type PlayerState = null | Readonly<{
  currentTime: number
  duration: number
  ended: boolean
  error: MediaError | null
  paused: boolean
  playbackRate: number
  seeking: boolean
}>

export const useVideoPlayer = (): UseVideoPlayerReturnType => {
  const [playerState, setPlayerState] = useState<PlayerState>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)

  useEffect(() => {
    const copyPlayerStateFromRef = () => {
      if (video === null) {
        setPlayerState(null)
      } else {
        setPlayerState({
          currentTime: video.currentTime,
          duration: video.duration,
          ended: video.ended,
          error: video.error,
          paused: video.paused,
          playbackRate: video.playbackRate,
          seeking: video.seeking
        })
      }
    }

    copyPlayerStateFromRef()
      if (video === null) {
      return
      }

    const EVENTS = [
      "play",
      "pause",
      "durationchange",
      "ended",
      "ratechanged",
      "error",
      "loadedmetadata",
      "progress"
    ] as const

    for (const eventName in EVENTS) {
      video.addEventListener(eventName, copyPlayerStateFromRef);
    }

    return () => {
      for (const eventName in EVENTS) {
        video.removeEventListener(eventName, copyPlayerStateFromRef);
      }
    }
  }, [video]);

  return {
    playerState,
    setVideo,
    video
  };
};

export type UseBehaveVideoPlayerReturnType = UseVideoPlayerReturnType & {
  playerState: null | {
    currentFrameNumber: number
    durationInFrames: number
  }
  setVideoProperties: (properties: {fps: number, frameOffset: number}) => void
  seekToFrameNumber: (frameNumber: number) => void
}

export const useBehaveVideoPlayer = (): UseBehaveVideoPlayerReturnType => {
  const {playerState, setVideo, video} = useVideoPlayer()
  const [videoProperties, setVideoProperties] = useState({fps: NaN, frameOffset: 0})

  const seekToFrameNumber = (frameNumber: number) => {
    if (!video) {
      throw new Error("Video not set")
    }
    if (isNaN(videoProperties.fps)) {
      throw new Error("FPS not set")
    }
    video.currentTime = (frameNumber - videoProperties.frameOffset) / videoProperties.fps
  }

  return {
    playerState: playerState && {
      ...playerState,
      currentFrameNumber: Math.round(playerState.currentTime * videoProperties.fps) + videoProperties.frameOffset,
      durationInFrames: Math.round(playerState.duration * videoProperties.fps),
    },
    setVideo,
    video,
    setVideoProperties,
    seekToFrameNumber,
  }
}
