import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import { useSelector } from "react-redux"
import { behaviourInfoCreatedNew, behaviourInfoUnset, selectBehaviourInfo, selectBehaviourInfoLinesInsertIndexForCurrentFrame, selectBehaviourLineWithoutBehaviour } from "./behaviourSlice"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectBehaviourLayout } from "./settingsSlice"
import { useAppDispatch } from "./store"
import { useEffect } from "react"
import * as css from "./behaviour.module.css"
import { selectSelectedSubject } from "./appSlice"

const BehaviourEditor: FunctionComponent = () => {
  const behaviourInfo = useSelector(selectBehaviourInfo)!
  const dispatch = useAppDispatch()
  const insertLine = useSelector(selectBehaviourLineWithoutBehaviour)
  const insertSpot = useSelector(selectBehaviourInfoLinesInsertIndexForCurrentFrame)

  const lines = [...behaviourInfo.lines]
  if (insertLine) {
    lines.splice(insertSpot, 0, insertLine)
  }


  return <table className={css.table}
    style={Object.fromEntries(behaviourInfo.layout.map(
      ({width}, index) => [`--width_${index + 1}`, width === "*" ? "auto" : `${width}em`]))}>
    <tbody>
      {lines.map((line, index) => <tr className={insertLine && insertSpot === index ? css.aboutToBeInserted : ""}>
        {line.map(item => <td>{item}</td>)}
      </tr>)}
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
