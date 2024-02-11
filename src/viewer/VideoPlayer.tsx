import { FunctionComponent } from "preact"
import { useAppDispatch } from "./store"
import * as viewercss from "./viewer.module.css"
import * as css from "./videoplayer.module.css"
import { useSelector } from "react-redux"
import { selectVideoFilePotentiallyNull, videoFileSet } from "./videoFileSlice"
import { ModalPopup } from "../lib/ModalPopup"
import { useRef, useState, useEffect} from 'preact/hooks'
import { playerStateSet, videoPlayerElementIdSet } from "./videoPlayerSlice"
import { assert } from "../lib/util"
import { selectRealOrDefaultSettingsByDetectionClass, selectVisibleDetectionsForCurrentFrame } from "./selectors"


const DummyCanvas: FunctionComponent<{message: string}> = ({message}) => {
  return <div className={[css.canvas, css.dummy].join(" ")}>
    {message}
  </div>
}

const VideoCanvas: FunctionComponent<{
  videoFile: File
}> = ({videoFile}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const detections = useSelector(selectVisibleDetectionsForCurrentFrame)
  const settingsByDetectionClass = useSelector(selectRealOrDefaultSettingsByDetectionClass)
  const [videoDimensions, setVideoDimensions] = useState<null | [number, number]>(null)
  const dispatch = useAppDispatch()
  const copyAndDispatchPlayerState = (video: HTMLVideoElement) => {
    dispatch(playerStateSet({
      currentTime: video.currentTime,
      duration: video.duration,
      ended: video.ended,
      error: video.error,
      paused: video.paused,
      playbackRate: video.playbackRate,
      seeking: video.seeking,
    }))
  }

  useEffect(() => {
    assert(!!videoRef.current,
      "useEffect is supposed to only run after rendering, so videoRef.current should be set")
    const video = videoRef.current
    dispatch(videoPlayerElementIdSet(video.id))
    copyAndDispatchPlayerState(video)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== videoRef.current) {
          console.warn("Unexpected target: ", entry)
          return
        }
        if (entry.contentBoxSize.length !== 1) {
          console.warn("Unexpected length: ", entry)
          return
        }

        setVideoDimensions([
          entry.contentBoxSize[0].inlineSize,
          entry.contentBoxSize[0].blockSize
        ])

      }
    })
    resizeObserver.observe(videoRef.current)
    return () => {
      dispatch(playerStateSet(null))
      dispatch(videoPlayerElementIdSet(null))
      resizeObserver.disconnect()
      setVideoDimensions(null)
    }
  }, [videoRef.current])

  const syncState = (e: Event) => {
    copyAndDispatchPlayerState(e.target as HTMLVideoElement)
  }

  return  <>
    {videoDimensions && settingsByDetectionClass && detections && <svg className={css.overlay}
      viewBox={`0 0 ${videoDimensions[0]} ${videoDimensions[1]}`}
      height={`${videoDimensions[1]}px`} width={`${videoDimensions[0]}px`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {detections.map(det => <g
        className={css.detection}
        style={{
          "--box-colour": settingsByDetectionClass.get(`${det.klass}`)!.colour,
          "--box-alpha": settingsByDetectionClass.get(`${det.klass}`)!.alpha,
          "--cx": det.cx.toFixed(3),
          "--cy": det.cy.toFixed(3),
          "--width": det.width.toFixed(3),
          "--height": det.height.toFixed(3),
        }}
      >
        <rect className={css.box} />
        <rect className={css.confidence_background} />
        <text className={css.confidence_text}>{det.confidence.toFixed(2)}</text>
      </g>
      )}
    </svg>
    }
    <video ref={videoRef} id="myVideoPlayer" className={css.canvas}
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
  </>
}


export const VideoPlayer: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const dispatch = useAppDispatch()
  type DragState = "nodrag" | "dragging"
  const dragCounter = useRef(0)
  const [dragState, setDragState] = useState<DragState>("nodrag")
  const [uploadError, setUploadError] = useState<string | null>(null)

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
      setUploadError(null)

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
      const match = file.name.match(/^.*\.(?<hash>.{16})\.mp4$/)

      dispatch(videoFileSet({file, xxh64sum: match?.groups?.hash ?? file.name}))
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
    {uploadError ? <ModalPopup addOkButtonCallback={() => setUploadError(null)} >{uploadError}</ModalPopup> : ""}
    {videoFile && dragState === "nodrag"
      ? <VideoCanvas videoFile={videoFile.file} />
      : <DummyCanvas message={dragState=="dragging" ? "Drop file here" : "Start by dropping in a video file"} />
    }
  </div>
}
