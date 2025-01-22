import { FunctionComponent } from 'preact'
import { useState, useCallback } from 'preact/hooks';
import { assert, joinedStringFromDict} from "../lib/util"
import { videoSeekToFrameNumberAndPause } from './videoPlayerActions';
import { useSelector } from 'react-redux';
import * as css from "./detectionbardetections.module.css"
import { useAppDispatch } from './store';
import { selectCurrentFrameNumber } from './selectors';
import { selectMetadata } from './videoFileSlice';

const MOUSE_PRIMARY_BUTTON = 0 as const

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

export const DetectionBarNoDetections: FunctionComponent = () => {
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const metadata = useSelector(selectMetadata)
  assert(metadata !== null)

  const location = (currentFrameNumber ?? NaN) / metadata?.numberOfFrames
  const dispatch = useAppDispatch()
  const [hoverInfo, setHoverInfo] = useState<{
    x: number, y: number, frameNumber: number} | null>(null)

  const [[barRect, _bar], barRef] = useClientRect<HTMLDivElement>()

  const getFrameNumberFromMouseEvent = (ev: MouseEvent): number => {
    ev.preventDefault()
    if (!barRect || currentFrameNumber === null) {
      return NaN;
    }
    return Math.floor(ev.offsetX / barRect.width * metadata.numberOfFrames)
  }

  const moveToMouseFrame = (ev: MouseEvent) => {
    ev.preventDefault()
    const newFrameNumber = getFrameNumberFromMouseEvent(ev)
    if (isNaN(newFrameNumber)) {
      return
    }
    void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
  }

  if (
    currentFrameNumber == null
      || barRect == null
  ) {
    return <div className={css.detectionBanner} ref={barRef}></div>
  } else {
    return <div className={css.detectionBanner}
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
        setHoverInfo(
          {x: ev.offsetX, y: ev.offsetY, frameNumber: frameNumber})
        if (ev.buttons & (1 << MOUSE_PRIMARY_BUTTON)) {
          //drag
          moveToMouseFrame(ev);
        }}}
      ref={barRef}
      style={{"--progress": location}}>
      <div className={joinedStringFromDict({
        [css.hoverInfo]: true,
        [css.rightside]: !!hoverInfo && hoverInfo.x > barRect.width / 2,
        [css.active]: hoverInfo !== null
      })} style={hoverInfo ? {
          "--x": `${hoverInfo.x}px`,
          "--y": `${hoverInfo.y}px`,
        } : {}}
      >
        {hoverInfo && <>Frame {hoverInfo.frameNumber}</>}
      </div>
      <div class={css.progress_bar}>
        <span class={css.cursorSpan}>&#x2666;</span>
      </div>
    </div>
  }
}
