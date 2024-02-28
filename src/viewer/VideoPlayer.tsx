import { FunctionComponent } from "preact"
import { useAppDispatch } from "./store"
import * as viewercss from "./viewer.module.css"
import * as css from "./videoplayer.module.css"
import { useSelector } from "react-redux"
import { selectVideoFilePotentiallyNull, selectVideoUrl } from "./videoFileSlice"
import { useRef, useState, useEffect} from 'preact/hooks'
import { playerStateSet, selectVideoAspect, videoPlayerElementIdSet } from "./videoPlayerSlice"
import { assert, joinedStringFromDict } from "../lib/util"
import { selectSettingsByDetectionClassForCurrectDetections, selectVisibleDetectionsForCurrentFrame } from "./selectors"
import { ConfidenceLocation, selectConfidenceLocation } from "./generalSettingsSlice"
import { DetectionsForFrame } from "../lib/detections"
import { zoomLevels, selectHideDetectionBoxes, selectZoom, zoomSet, } from "./appSlice"
import { HSL, hslToLuminance, hslToString } from "../lib/colour"
import { Icon } from "../lib/Icon"


const DummyCanvas: FunctionComponent = () => {
  return <div className={[css.canvas, css.dummy].join(" ")}>
    <Icon iconName="arrow_left_alt" /> Press here to open the uploader to get started
  </div>
}

const VideoCanvas: FunctionComponent = () => {
  const videoUrl = useSelector(selectVideoUrl)
  assert(videoUrl !== null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const detections = useSelector(selectVisibleDetectionsForCurrentFrame)
  const settingsByDetectionClass = useSelector(selectSettingsByDetectionClassForCurrectDetections)
  const confidenceLocation = useSelector(selectConfidenceLocation)
  const videoAspectRatio = useSelector(selectVideoAspect)
  const [containerDimensions, setContainerDimensions] = useState<null | {width: number, height: number, zoom: number}>(null)
  const [mouseCoords, setMouseCoords] = useState({x: 0, y: 0})
  const hideDetectionBoxes = useSelector(selectHideDetectionBoxes)
  const dispatch = useAppDispatch()
  const zoom = useSelector(selectZoom)
  const [zoomOrigin, setZoomOrigin] = useState({x: "0px", y: "0px"})
  const containerRef = useRef<HTMLDivElement>(null)
  const [shiftPressed, setShiftPressed] = useState(false)

  const clickAction = shiftPressed
    ? (zoom === 0 ? null : "zoom-out")
    : zoom === zoomLevels.length - 1
    ? "zoom-out-all" : "zoom-in"

  const copyAndDispatchPlayerState = (video: HTMLVideoElement) => {
    dispatch(playerStateSet({
      currentTime: video.currentTime,
      duration: video.duration,
      ended: video.ended,
      error: video.error,
      paused: video.paused,
      playbackRate: video.playbackRate,
      seeking: video.seeking,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    }))
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      setShiftPressed(e.shiftKey)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      setShiftPressed(e.shiftKey)
    }
    document.documentElement.addEventListener("keyup", onKeyUp)
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => {
      document.documentElement.removeEventListener("keyup", onKeyUp)
      document.documentElement.removeEventListener("keydown", onKeyDown)
    }

  }, [])

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

  useEffect(() => {
    assert(!!containerRef.current,
      "useEffect is supposed to only run after rendering, so videoRef.current should be set")
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== containerRef.current) {
          console.warn("Unexpected target: ", entry)
          return
        }
        if (entry.contentBoxSize.length !== 1) {
          console.warn("Unexpected length: ", entry)
          return
        }
        const {inlineSize: width, blockSize: height} = entry.contentBoxSize[0]
        const parent = containerRef.current.parentElement
        assert(!!parent && parent.matches(".videoplayer_toplevel"))
        const zoom = Math.max(
          width / parent.clientWidth,
          height / parent.clientHeight,
        )

        setContainerDimensions({width, height, zoom})

      }
    })
    resizeObserver.observe(containerRef.current)
    return () => {
      resizeObserver.disconnect()
      setContainerDimensions(null)
    }
  }, [videoRef.current])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const onMouseMove = (e: MouseEvent) => {
      setShiftPressed(e.shiftKey)
      const parent = container.parentElement
      if(!parent) {
        return
      }
      const bounding = parent.getBoundingClientRect()
      setMouseCoords({
        x: e.clientX - bounding.left,
        y: e.clientY - bounding.top,
      })
    }
    container.addEventListener("mousemove", onMouseMove)
    return () => container.removeEventListener("mousemove", onMouseMove)
  }, [containerRef.current, containerRef.current?.parentElement])


  useEffect(() => {
    if (!containerRef.current) {
      return
    }
    const container = containerRef.current
    const onClick = (e: MouseEvent) => {
      if (e.shiftKey) {
        if (zoom === 0) {
          console.log("zoom out is no-op when at minimal zoom")
        } else {
          dispatch(zoomSet(zoom - 1))
        }
      } else {
        if (zoom === zoomLevels.length - 1) {
          dispatch(zoomSet(0))
        } else {
          dispatch(zoomSet(zoom + 1))
        }
      }
    }
    container.addEventListener("click", onClick)
    return () => container.removeEventListener("click", onClick)
  }, [containerRef.current, zoom])

  useEffect(() => {
    if (zoom === 0) {
      return;
    }
    const focusX = `${mouseCoords.x.toFixed(0)}px`
    const focusY = `${mouseCoords.y.toFixed(0)}px`
    setZoomOrigin({x: focusX, y: focusY})
  }, [zoom, zoom !== 0 && mouseCoords])

  useEffect(() => {
    if (!videoRef.current || !videoUrl) {
      return
    }
    videoRef.current.pause();
    videoRef.current.load();
    videoRef.current.currentTime = 0
  }, [videoUrl, videoRef.current])

  const syncState = (e: Event) => {
    copyAndDispatchPlayerState(e.target as HTMLVideoElement)
  }

  const haveHorizontalSpace = !!containerDimensions  && videoAspectRatio !== null && containerDimensions.width / containerDimensions.height > videoAspectRatio 
  const [videoWidth, videoHeight] = (!containerDimensions || videoAspectRatio === null)
  ? [0, 0] : haveHorizontalSpace
  ? [containerDimensions.height * videoAspectRatio, containerDimensions.height]
  : [containerDimensions.width, containerDimensions.width / videoAspectRatio]

  return <div ref={containerRef} className={joinedStringFromDict({
    [css.container]: true,
    [css.cursor_zoomin]: clickAction === "zoom-in",
    [css.cursor_zoomout]: clickAction === "zoom-out" || clickAction === "zoom-out-all"
    })} style={{
      "--zoom": zoomLevels[zoom],
      "--focus-x": zoomOrigin.x,
      "--focus-y": zoomOrigin.y,
      "--video-width": `${videoWidth.toFixed(1)}px`,
      "--video-height": `${videoHeight.toFixed(1)}px`,
      "--video-zoom": `${containerDimensions?.zoom.toFixed(3)}`,
    }}>
    {settingsByDetectionClass && detections && !hideDetectionBoxes && <svg className={css.overlay}
      viewBox={`0 0 ${videoWidth} ${videoHeight}`}
      height={`${videoHeight}px`} width={`${videoWidth}px`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {detections.map(detection => <Detection
        detection={detection} confidenceLocation={confidenceLocation}
        colour={settingsByDetectionClass.get(`${detection.klass}`)!.colour}
        alpha={settingsByDetectionClass.get(`${detection.klass}`)!.alpha}
        />
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
      <source src={videoUrl} />
    </video>
  </div>
}


export const VideoPlayer: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFilePotentiallyNull)

  return <div className={joinedStringFromDict({[viewercss.videoplayer]: true, "videoplayer_toplevel": true})}>
    {videoFile
      ? <VideoCanvas />
      : <DummyCanvas />
    }
  </div>
}

type DetectionProps = {
  detection: DetectionsForFrame[0]
  colour: HSL
  confidenceLocation: ConfidenceLocation
  alpha: number
}
export const Detection: FunctionComponent<DetectionProps> = (
  {detection, colour, confidenceLocation, alpha}) => {
  const [outer_inner, horizontal, vertical] = confidenceLocation === "off" ? [null, null, null] : confidenceLocation.split("-")
  const textColour = hslToLuminance(colour) > .5 ? "black" : "white";
  return <g
    className={joinedStringFromDict({
      [css.detection]: true,
      [css.hide]: false, //TODO
      [css.hide_confidence]: confidenceLocation === "off",
      [css.top]: vertical === "top",
      [css.bottom]: vertical === "bottom",
      [css.left]: horizontal === "left",
      [css.center]: horizontal === "center",
      [css.right]: horizontal === "right",
      [css.outer]: outer_inner === "outer",
      [css.inner]: outer_inner === "inner",
    })}
    style={{
      "--box-colour": hslToString(colour),
      "--text-colour": textColour,
      "--box-alpha": alpha,
      "--cx": detection.cx.toFixed(3),
      "--cy": detection.cy.toFixed(3),
      "--width": detection.width.toFixed(3),
      "--height": detection.height.toFixed(3),
    }}
  >
    <rect className={css.box} />
    <rect className={css.confidence_background} />
    <text className={css.confidence_text}>{detection.confidence.toFixed(2)}</text>
  </g>
}
