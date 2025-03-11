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
import { selectHideDetectionBoxes, selectZoomLevel, zoomChanged} from "./appSlice"
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
  const zoom = useSelector(selectZoomLevel)
  const containerRef = useRef<HTMLDivElement>(null)

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

        // delay to prevent firing resizeObserver in this paint cycle
        window.setTimeout(() => setContainerDimensions({width, height, zoom}), 1)

      }
    })
    resizeObserver.observe(containerRef.current)
    return () => {
      resizeObserver.disconnect()
      setContainerDimensions(null)
    }
  }, [videoRef.current])

  const onMouseMove = (e: MouseEvent) => {
    const container = e.currentTarget as HTMLDivElement
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

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) {
      return
    }
    if (e.deltaY === 0) {
    return
    }
    dispatch(zoomChanged(e.deltaY * 0.1))
  }

  const zoomOrigin = {
    x: `${mouseCoords.x.toFixed(0)}px`,
    y: `${mouseCoords.y.toFixed(0)}px`,
  }


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
    })} style={{
      "--zoom": zoom,
      "--focus-x": zoomOrigin.x,
      "--focus-y": zoomOrigin.y,
      "--video-width": `${videoWidth.toFixed(1)}px`,
      "--video-height": `${videoHeight.toFixed(1)}px`,
      "--video-zoom": `${containerDimensions?.zoom.toFixed(3)}`,
    }} onMouseMove={onMouseMove} onWheel={onWheel}>
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
