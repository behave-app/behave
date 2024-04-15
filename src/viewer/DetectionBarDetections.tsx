import { FunctionComponent } from 'preact'
import { useMemo, useState, useCallback } from 'preact/hooks';
import { assert, binIndices, range, joinedStringFromDict, TSAssertType } from "../lib/util"
import { videoSeekToFrameNumberAndPause } from './videoPlayerActions';
import { useSelector } from 'react-redux';
import { selectDetectionInfoPotentiallyNull } from './detectionsSlice';
import * as css from "./detectionbardetections.module.css"
import { useAppDispatch } from './store';
import { selectColoursForClasses, selectConfidenceCutoffByClass, selectCurrentFrameNumber } from './selectors';
import { hslToString } from '../lib/colour';
import { selectMetadata } from './videoFileSlice';

type UseClientRect<T extends (HTMLElement | SVGElement)> =
  () => [[DOMRect | null, T | null], (node: T | null) => void]

const useClientRect = (<T extends (HTMLElement | SVGElement)>(): ReturnType<UseClientRect<T>> => {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [el, setEl] = useState<T | null>(null);

  const ref = useCallback((node: T | null) => {
    setEl(node)
    if (node !== null) {
      const updateRect = () => {
        setRect(node.getBoundingClientRect());
      }
      new ResizeObserver(updateRect).observe(node)
    }
  }, []);
  return [[rect, el], ref];
})

/**
The HeightLine describes a line as to be plot in the graph.
Each entry describes how high the line is, and for how many places this height
is maintained

HeightLineByKlass is then a mapping for each klass in the detections,
as well as "allIncludingInvisibleLine"
*/
type HeightLine = {width: number, cnt: number}[]
const allIncludingInvisibleLine = Symbol("allIncludingInvisibleLine")
type HeightLineByKlass = Map<
  `${number}` | typeof allIncludingInvisibleLine, HeightLine>

const heightLineToPathD = (line: HeightLine): string => {
  const path_d = ["M 0 0"]
  let section_width = 0
  line.forEach(x => {
    if (x.cnt === 0) {
      if (path_d.length > 1) {
        path_d.push("V 0 Z") // close this figure
      }
      path_d.push(`m ${section_width + x.width} 0`)
      section_width = 0
    } else {
      section_width += x.width
      path_d.push(`V ${x.cnt} h ${x.width}`)
    }
  })
  path_d.push("V 0 Z")
  return path_d.join(" ")
}

const MOUSE_PRIMARY_BUTTON = 0 as const

const SCALES = [
  [5, 5],
  [8, 4],
  [10, 2],
  [20, 4],
  [40, 4],
  [50, 5],
  [80, 4],
  [100, 4],
] as const;

const TOP_SCALING_FACTOR = 2;
const BETWEEN_LAYERS_HEIGHT_FACTOR = 0.1;

export const DetectionBarDetections: FunctionComponent = () => {
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const detectionInfo = useSelector(selectDetectionInfoPotentiallyNull)
  const confidenceCutoffByClass = useSelector(selectConfidenceCutoffByClass)
  const coloursForClass = useSelector(selectColoursForClasses)
  const metadata = useSelector(selectMetadata)
  const dispatch = useAppDispatch()
  const [hoverInfo, setHoverInfo] = useState<{
    x: number, y: number, frameNumber: number} | null>(null)
  assert(metadata !== null)
  assert(detectionInfo !== null)
  assert(confidenceCutoffByClass !== null)

  const [[svgRect, _svg], svgRef] = useClientRect<SVGElement>()

  const getFrameNumberFromMouseEvent = (ev: MouseEvent): number => {
    ev.preventDefault()
    if (!svgRect || currentFrameNumber === null) {
      return NaN;
    }
    return ev.offsetY > svgRect.height / 2
      ? Math.floor(ev.offsetX / svgRect.width * metadata.numberOfFrames)
      : currentFrameNumber + Math.floor(
        (ev.offsetX - svgRect.width / 2) / TOP_SCALING_FACTOR)
  }

  const moveToMouseFrame = (ev: MouseEvent) => {
    ev.preventDefault()
    const newFrameNumber = getFrameNumberFromMouseEvent(ev)
    if (isNaN(newFrameNumber)) {
      return
    }
    void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
  }

  const svgViewBox =
    svgRect ? `0 0 ${svgRect.width} ${svgRect.height}` : `0 0 314 153`

  const [heightLines, scalingInfo] = useMemo(() => {
    if (svgRect === null) {
      return [null, null]
    }
    const allKlasses = Object.keys(detectionInfo.modelKlasses)
    const heightLines: HeightLineByKlass = new Map([
      // put them in the order of display (from back to front)
      [allIncludingInvisibleLine, [{cnt: 0, width: 0}]],
      ...allKlasses.reverse().map(key => [key, [{cnt:0, width: 0}]]),
    ] as Array<[`${number}` | typeof allIncludingInvisibleLine, HeightLine]>)

    for (const frameInfo of detectionInfo.framesInfo) {
      if (frameInfo === null) {
        continue
      }
      const indicesByKlass = binIndices(frameInfo.detections
        .filter(d => d.confidence >= confidenceCutoffByClass.get(`${d.klass}`)!).map(d => d.klass.toString()))
      for (const klass of heightLines.keys()) {
        const newCount = (
          klass === allIncludingInvisibleLine
            ? frameInfo.detections.length
            : (indicesByKlass.get(klass) ?? []).length)
        const lastEntry = heightLines.get(klass)!.at(-1)!
        if (lastEntry.cnt === newCount) {
          lastEntry.width += 1
        } else {
          heightLines.get(klass)!.push({cnt: newCount, width: 1})
        }
      }
    }

    const maxDetections = Math.max(
      ...heightLines.get(allIncludingInvisibleLine)!.map(l => l.cnt))
    const scalingInfo = SCALES.find(([max]) => max >= maxDetections)!
    return [heightLines, scalingInfo] as [HeightLineByKlass, typeof scalingInfo]
  }, [detectionInfo, svgRect, confidenceCutoffByClass])

  if (
    scalingInfo == null
      || currentFrameNumber == null
      || heightLines == null
      || svgRect == null
      || coloursForClass === null
  ) {
    return <div className={css.detectionBanner}><svg ref={svgRef}></svg></div>
  } else {
    const totalFrames = metadata.numberOfFrames
    return <div className={css.detectionBanner}>
      <div className={joinedStringFromDict({
        [css.hoverInfo]: true,
        [css.rightside]: !!hoverInfo && hoverInfo.x > svgRect.width / 2,
        [css.active]: hoverInfo !== null
      })} style={hoverInfo ? {
          "--x": `${hoverInfo.x}px`,
          "--y": `${hoverInfo.y}px`,
        } : {}}
      >
        {hoverInfo && detectionInfo.framesInfo.at(hoverInfo.frameNumber) && <>
          Frame {hoverInfo.frameNumber}: <ul>{(() => {
            const detections = detectionInfo.framesInfo[hoverInfo.frameNumber]?.detections
            if (detections === undefined) {
              return ""
            }
            if (detections.length === 0) {
              return <li>no detections</li>
            }
            const indicesByKlass = binIndices(detections.map(d => d.klass.toString()))
            const indicesByKlassWitinConfidence = binIndices(
              detections.filter(d => d.confidence >= confidenceCutoffByClass.get(`${d.klass}`)!)
                .map(d => d.klass.toString()))
            return Object.keys(detectionInfo.modelKlasses).map(klassKey => {
              TSAssertType<`${number}`>(klassKey)
              const nrDetections = indicesByKlass.get(klassKey)?.length ?? 0
              if (nrDetections === 0) {
                return <></>
              }
              const nrDetectionsWithinConfidence = indicesByKlassWitinConfidence.get(
                klassKey)?.length ?? 0
              return <li>{detectionInfo.modelKlasses[klassKey]}
                : <span style={{color: hslToString(coloursForClass.get(klassKey)!)}}>
                  {nrDetectionsWithinConfidence} ({nrDetections})
                </span>
              </li>
            })
          })()}</ul>
        </>}
      </div>
      <svg ref={svgRef} viewBox={svgViewBox}
        style={{"--svgWidth": svgRect.width, "--svgHeight": svgRect.height,
          "--totalNumberOfFrames": totalFrames, "--maxCount": scalingInfo[0],
          "--currentFrame": currentFrameNumber,
          "--between-layers-height": svgRect.height * BETWEEN_LAYERS_HEIGHT_FACTOR,
          "--top-scaling-factor": TOP_SCALING_FACTOR
        }}
        onMouseDown={ev => {
          // Note: ev.button specifies which button was pressed, while ev.buttons
          // is a bitmap of pressed buttons
          if (ev.button == MOUSE_PRIMARY_BUTTON) {
            moveToMouseFrame(ev)
          }
        }}
        onMouseOut={() => setHoverInfo(null)}
        onMouseMove={ev => {
          const frameNumber = getFrameNumberFromMouseEvent(ev)
          if (detectionInfo.framesInfo[frameNumber] === undefined) {
            setHoverInfo(null)
          } else {
            setHoverInfo(
              {x: ev.offsetX, y: ev.offsetY, frameNumber: frameNumber})
          }
          if (ev.buttons & (1 << MOUSE_PRIMARY_BUTTON) &&
            ev.offsetY > svgRect.height / 2  // only lower half, since top half moves so dragging effect would be very annoying
          ) {
            moveToMouseFrame(ev);
          }
        }} >
        <defs>
          <g id="detection-lines" className={css.detectionLines}>
            {[...heightLines.entries()].map(
              ([klassOrAll, heightLine]) =>
                <path style={{
                  "--line-colour": hslToString(coloursForClass.get(klassOrAll === allIncludingInvisibleLine ? "all" : klassOrAll)!),
                  "--detection-klass": klassOrAll === allIncludingInvisibleLine
                    ? "allIncludingInvisible"
                    : detectionInfo.modelKlasses[klassOrAll],
                }} class={css.detections} d={heightLineToPathD(heightLine)} />
            )}
            <g class={css.horizontalRulers}>
              {range(0, scalingInfo[1] + 1).map(i => {
                const y = i * scalingInfo[0] / scalingInfo[1]
                return <>
                  <line key={y} x1="0" y1={y} x2={totalFrames} y2={y} />
                </>
              })}
            </g>
          </g>
          <g id="cursor" className={css.cursor}>
            <path
              d={`M 0 1 V 0.1 l -3 -.1 h 6 l -3 .1 Z`} />
          </g>
        </defs>
        <use href="#detection-lines" className={css.detectionsTop} />
        <use href="#detection-lines" className={css.detectionsBottom} />
        <use href="#cursor" className={css.cursorTop} />
        <g className={css.cursorBottom}>
          <rect />
          <use href="#cursor"/>
        </g>
      </svg>
    </div>
  }
}
