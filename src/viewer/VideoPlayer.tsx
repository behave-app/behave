import { FunctionComponent } from "preact"
import { useAppDispatch } from "./store"
import * as viewercss from "./viewer.module.css"
import * as css from "./videoplayer.module.css"
import { useSelector } from "react-redux"
import { selectVideoFilePotentiallyNull, videoFileSet } from "./videoFileSlice"
import { ModalPopup } from "src/lib/ModalPopup.js"
import { useRef, useState, useEffect} from 'preact/hooks'
import { playerStateSet, videoPlayerElementIdSet } from "./videoPlayerSlice"
import { assert } from "src/lib/util"


export const ACTIONS: Record<string, {description: string}> = {
  play_pause: {description: "Pause if playing, start playing if paused"},
  speed_up: {description: "Increase playback speed"},
  speed_down: {description: "Decrease playback speed"},
  next_frame: {description: "Next frame"},
  previous_frame: {description: "Previous frame"},
  next_frame_with_detection: {description: "Next frame with detection"},
  previous_frame_with_detection: {description: "Previous frame with detection"},
} as const

const DummyCanvas: FunctionComponent<{message: string}> = ({message}) => {
  return <div className={[css.canvas, css.dummy].join(" ")}>
    {message}
  </div>
}

const VideoCanvas: FunctionComponent<{
  videoFile: File
}> = ({videoFile}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const dispatch = useAppDispatch()
  const copyAndDispatchPlayerState = (video: HTMLVideoElement) => {
    dispatch(playerStateSet({
      currentTime: video.currentTime,
      duration: video.duration,
      ended: video.ended,
      error: video.error,
      paused: video.paused,
      playbackRate: video.playbackRate,
      seeking: video.seeking
    }))
  }

  useEffect(() => {
    assert(!!videoRef.current,
      "useEffect is supposed to only run after rendering, so videoRef.current should be set")
    const video = videoRef.current
    dispatch(videoPlayerElementIdSet(video.id))
    copyAndDispatchPlayerState(video)
    return () => {
      dispatch(playerStateSet(null))
      dispatch(videoPlayerElementIdSet(null))
    }
  }, [videoRef.current])

  const syncState = (e: Event) => {
    copyAndDispatchPlayerState(e.target as HTMLVideoElement)
  }

  return <video ref={videoRef} id="myVideoPlayer" className={css.canvas}
    onPlay={syncState}
    onPause={syncState}
    onDurationChange={syncState}
    onEnded={syncState}
    onRateChange={syncState}
    onError={syncState}
    onLoadedMetadata={syncState}
    onSeeking={syncState}
    onSeeked={syncState}
    onTimeUpdate={syncState}
  >
    <source src={URL.createObjectURL(videoFile)} />
  </video>
}


export const VideoPlayer: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const dispatch = useAppDispatch()
  type DragState = "nodrag" | "dragging"
  const dragCounter = useRef(0)
  const [dragState, setDragState] = useState<DragState>("nodrag")
  const [uploadError, setUploadError] = useState<string>()

  useEffect(() => {
    const aimedAt = window.document.documentElement
    const dragEnter = (_event: DragEvent) => {
      dragCounter.current += 1
      setDragState("dragging")
    }
    const dragDrop = async (event: DragEvent) => {
      dragCounter.current -= 1
      event.preventDefault()
      setDragState("nodrag")
      setUploadError(undefined)

      if (event.dataTransfer === null || event.dataTransfer.items.length === 0) {
        setUploadError("Make sure you drag a file")
        return
      }
      if (event.dataTransfer.items.length > 1) {
        setUploadError("Only drop a single file")
        return
      }

      const fileHandle = await event.dataTransfer.items[0].getAsFileSystemHandle()
      if (!(fileHandle instanceof FileSystemFileHandle)) {
        setUploadError("Please upload a file")
        return
      }
      const file = await fileHandle.getFile()
      if (!file.name.toLowerCase().endsWith(".mp4")) {
        setUploadError("At the moment only mp4 videos are allowed")
        return
      }
      dispatch(videoFileSet({file, xxh64sum: "0"}))
    }
    const dragLeave = (_event: DragEvent) => {
      dragCounter.current -= 1
      if (dragCounter.current > 0) {
        return;
      }
      setDragState("nodrag")
    }
    const dragOver = (event: DragEvent) => {
      event.preventDefault()
    }
    aimedAt.addEventListener("dragenter", dragEnter)
    aimedAt.addEventListener("dragleave", dragLeave)
    aimedAt.addEventListener("dragover", dragOver)
    aimedAt.addEventListener("drop", dragDrop)
    return () => {
      aimedAt.removeEventListener("dragenter", dragEnter)
      aimedAt.removeEventListener("dragleave", dragLeave)
      aimedAt.removeEventListener("dragover", dragOver)
      aimedAt.removeEventListener("drop", dragDrop)
    }
  }, [])

  return <div className={viewercss.videoplayer}>
    {uploadError ? <ModalPopup addOkButtonCallback={() => setUploadError(undefined)} >{uploadError}</ModalPopup> : ""}
    {videoFile && dragState === "nodrag"
      ? <VideoCanvas videoFile={videoFile.file} />
      : <DummyCanvas message={dragState=="dragging" ? "Drop file here" : "Start by dropping in a video file"} />
    }
  </div>
}
