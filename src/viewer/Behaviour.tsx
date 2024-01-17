import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import { useSelector } from "react-redux"
import { behaviourInfoCreatedNew, behaviourInfoUnset, currentlySelectedLineUnset, selectBehaviourInfo, selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./behaviourSlice"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectBehaviourLayout } from "./settingsSlice"
import { useAppDispatch } from "./store"
import { useEffect } from "react"
import * as css from "./behaviour.module.css"
import { selectCurrentFrameNumber } from "./videoPlayerSlice"

const BehaviourEditor: FunctionComponent = () => {
  const behaviourInfo = useSelector(selectBehaviourInfo)!
  const dispatch = useAppDispatch()
  const insertLine = useSelector(selectBehaviourLineWithoutBehaviour)
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const selectedBehaviourLine = useSelector(selectSelectedBehaviourLine)!
  if (!selectSelectedBehaviourLine) {
    throw new Error("error")
  }

  useEffect(() => {
    dispatch(currentlySelectedLineUnset())
  }, [currentFrameNumber])

  return <table className={css.table}
    style={Object.fromEntries(behaviourInfo.layout.map(
      ({width}, index) => [`--width_${index + 1}`, width === "*" ? "auto" : `${width}em`]))}>
    <tbody>
      {behaviourInfo.lines.map((line, index) => {
        const className = insertLine ? ""
          : selectedBehaviourLine.index === index ? (
            selectedBehaviourLine.rel == "at" ? css.selectedLine
              : css.selectedLineAfter) : ""
        return <><tr className={className}>
          {line.map(item => <td>{item}</td>)}
        </tr>
          {insertLine && (selectedBehaviourLine.index === index) && 
            <tr className={css.aboutToBeInserted}>
              {insertLine.map(item => <td>{item}</td>)}
            </tr>
          }
        </>
      })}
    </tbody>
  </table>
}

const BehaviourCreator: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const defaultLayout = useSelector(selectBehaviourLayout)
  const dispatch = useAppDispatch()

  if (!videoFile) {
    return <div>Add video file first</div>
  }
  return <div>
    <button onClick={() => dispatch(behaviourInfoCreatedNew({
      videoFileName: videoFile.file.name,
      videoFileHash: videoFile.xxh64sum,
      createdDateTime: new Date().toISOString(),
      layout: defaultLayout,
    }))}>
      Create new behaviour file
    </button>
  </div>
}
export const Behaviour: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const behaviourInfo = useSelector(selectBehaviourInfo)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!behaviourInfo) {
      return
    }
    if (!videoFile || videoFile.xxh64sum !== behaviourInfo.sourceFileXxHash64) {
      dispatch(behaviourInfoUnset())
    }
  }, [videoFile, behaviourInfo])

  return <div className={viewercss.behaviour}>
    {behaviourInfo ? <BehaviourEditor /> : <BehaviourCreator />}
  </div>
}
