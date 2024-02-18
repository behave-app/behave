import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import { useSelector } from "react-redux"
import { behaviourInfoCreatedNew, behaviourInfoFieldEdited, behaviourInfoUnset, currentlyEditingFieldIndexSet, currentlySelectedLineUnset, currentlySelectedLineUpdated, selectBehaviourInfo, } from "./behaviourSlice"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectBehaviourLayout, selectFramenumberIndexInLayout } from "./generalSettingsSlice"
import { useAppDispatch } from "./store"
import { useEffect, useRef, useState } from "react"
import * as css from "./behaviour.module.css"
import { selectBehaviourLineWithoutBehaviour, selectCurrentFrameNumber, selectSelectedBehaviourLine } from "./selectors"
import { videoSeekToFrameNumberAndPause } from "./videoPlayerActions"
import { keyFromEvent } from "../lib/key"
import { behaviourInputSubjectUnselected } from "./appSlice"


const BehaviourEditor: FunctionComponent = () => {
  const [editingValue, setEditingValue] = useState("")
  const behaviourInfo = useSelector(selectBehaviourInfo)!
  const dispatch = useAppDispatch()
  const tableRef = useRef<HTMLTableElement>(null)
  const insertLine = useSelector(selectBehaviourLineWithoutBehaviour)
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const selectedBehaviourLine = useSelector(selectSelectedBehaviourLine)!
  const inputElementRef = useRef<HTMLInputElement>(null)
  const frameNumberIndexInLayout = useSelector(selectFramenumberIndexInLayout)
  if (!selectSelectedBehaviourLine) {
    throw new Error("error")
  }

  useEffect(() => {
    if (!tableRef.current) {
      return
    }
    const tr = tableRef.current.querySelector([
      "." + css.selectedLine,
      "." + css.selectedLineAfter,
      "." + css.aboutToBeInserted,
    ].join(", "))
    if (tr) {
      tr.scrollIntoView({behavior: "smooth", "block": "center"})
    }
  }, [selectedBehaviourLine, insertLine, tableRef.current])

  useEffect(() => {
    if (behaviourInfo.currentlySelectedLine
      && behaviourInfo.currentlyEditingFieldIndex === null
      && currentFrameNumber !== parseInt(
        (behaviourInfo.lines[behaviourInfo.currentlySelectedLine] ?? [])[frameNumberIndexInLayout])
    ) {
      dispatch(currentlySelectedLineUnset())
    }
  }, [currentFrameNumber, behaviourInfo.currentlyEditingFieldIndex])

  const startEditingField = (lineNumber: number, fieldNumber: number) => {
    if (lineNumber === 0) {
      console.warn("Not allowed editing the header line")
      return 
    }
    if (insertLine) {
      dispatch(behaviourInputSubjectUnselected())
    }
    if (fieldNumber === frameNumberIndexInLayout) {
      console.log("Frame number field not editable")
    }
    if (behaviourInfo.currentlyEditingFieldIndex !== null) {
      saveEdit()
    }
    const newFrameNumber = parseInt(
      (behaviourInfo.lines[lineNumber] ?? [])[frameNumberIndexInLayout])
    if (!isNaN(newFrameNumber)) {
      void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
    }
    setEditingValue(behaviourInfo.lines[lineNumber][fieldNumber])
    dispatch(currentlyEditingFieldIndexSet({
      currentlyEditingFieldIndex: fieldNumber,
      currentlySelectedLine: lineNumber,
    }))
  }

  const selectLine = (lineNumber: number) => {
    if (lineNumber === 0) {
      console.warn("Not allowed editing the header line")
      return 
    }
    if (insertLine) {
      dispatch(behaviourInputSubjectUnselected())
    }
    const newFrameNumber = parseInt(
      (behaviourInfo.lines[lineNumber] ?? [])[frameNumberIndexInLayout])
    if (!isNaN(newFrameNumber)) {
      void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
    }
    dispatch(currentlySelectedLineUpdated(lineNumber))
  }

  const editFieldKeyDown = (event: KeyboardEvent) => {
    if (behaviourInfo.currentlySelectedLine === null
      || behaviourInfo.currentlyEditingFieldIndex === null) {
      return
    }
    const key = keyFromEvent(event)
    if (key === null) {
      if (event.code === "Escape") {
        event.stopPropagation()
        dispatch(currentlyEditingFieldIndexSet({currentlyEditingFieldIndex: null}))

      }
      return;
    }
    event.stopPropagation()
    if (key.code === "Enter" && (key.modifiers ?? []).length === 0) {
      saveEdit()
    }
  }

  const saveEdit = () => {
    if (behaviourInfo.currentlySelectedLine === null
      || behaviourInfo.currentlyEditingFieldIndex === null) {
      return
    }
    dispatch(behaviourInfoFieldEdited({
      lineNumber: behaviourInfo.currentlySelectedLine!,
      fieldNumber: behaviourInfo.currentlyEditingFieldIndex,
      newContent: editingValue
    }))
    dispatch(currentlyEditingFieldIndexSet({currentlyEditingFieldIndex: null}))
    setEditingValue("")
  }

  useEffect(() => {
    if (inputElementRef.current) {
      inputElementRef.current.focus()
    }
  }, [behaviourInfo.currentlyEditingFieldIndex, behaviourInfo.currentlySelectedLine])

  return <table className={css.table}
    ref={tableRef}
    style={Object.fromEntries(behaviourInfo.layout.map(
      ({width}, index) => [`--width_${index + 1}`, width === "*" ? "auto" : `${width}em`]))}>
    <tbody>
      {behaviourInfo.lines.map((line, index) => {
        const className = insertLine ? ""
          : selectedBehaviourLine.index === index ? (
            selectedBehaviourLine.rel == "at" ? css.selectedLine
              : css.selectedLineAfter) : ""
        return <><tr className={className}>
          {line.map((item, fieldIndex) => <td>
            {fieldIndex !== frameNumberIndexInLayout
              && behaviourInfo.currentlySelectedLine === index
              && behaviourInfo.currentlyEditingFieldIndex === fieldIndex
              ? <input ref={inputElementRef} onKeyDown={editFieldKeyDown} onInput={
                e => setEditingValue((e.target as HTMLInputElement).value)}
                onBlur={() => saveEdit()}
                value={editingValue} />
              : <span
                onClick={() => selectLine(index)}
                onDblClick={() => startEditingField(index, fieldIndex)}
              >
                {item}
              </span>}
          </td>)}
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
