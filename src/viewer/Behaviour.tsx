import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import { useSelector } from "react-redux"
import { behaviourInfoCreatedNew, editBehaviourInfoLineField, setCurrentlyEditingFieldIndex, currentlySelectedLineUnset, currentlySelectedLineUpdated, selectBehaviourInfo, behaviourInfoSubjectUnselected, } from "./behaviourSlice"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectBehaviourLayout, selectFramenumberIndexInLayout } from "./generalSettingsSlice"
import { useAppDispatch } from "./store"
import { useEffect, useRef, useState } from "react"
import * as css from "./behaviour.module.css"
import { selectBehaviourLineWithoutBehaviour, selectCurrentFrameNumber, selectSelectedBehaviourLine } from "./selectors"
import { videoSeekToFrameNumberAndPause } from "./videoPlayerActions"
import { keyFromEvent } from "../lib/key"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice"
import { valueOrErrorAsync } from "../lib/util"


const BehaviourEditor: FunctionComponent = () => {
  const [editingValue, setEditingValue] = useState("")
  const behaviourInfo = useSelector(selectBehaviourInfo)!
  const dispatch = useAppDispatch()
  const tableRef = useRef<HTMLTableElement>(null)
  const insertLine = useSelector(selectBehaviourLineWithoutBehaviour)
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const selectedBehaviourLine = useSelector(selectSelectedBehaviourLine)
  const inputElementRef = useRef<HTMLInputElement>(null)
  const frameNumberIndexInLayout = useSelector(selectFramenumberIndexInLayout)
  if(selectedBehaviourLine === null) {
    return <div>Wait for video to load</div>
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
    if (behaviourInfo.currentlySelectedLine !== null
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
      dispatch(behaviourInfoSubjectUnselected())
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
    void(dispatch(setCurrentlyEditingFieldIndex({
      currentlyEditingFieldIndex: fieldNumber,
      currentlySelectedLine: lineNumber,
    })))
  }

  const selectLine = (lineNumber: number) => {
    if (lineNumber === 0) {
      console.warn("Not allowed editing the header line")
      return 
    }
    if (insertLine) {
      dispatch(behaviourInfoSubjectUnselected())
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
        void(dispatch(setCurrentlyEditingFieldIndex(
          {currentlyEditingFieldIndex: null})))

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
    void(dispatch(editBehaviourInfoLineField({
      lineNumber: behaviourInfo.currentlySelectedLine!,
      fieldNumber: behaviourInfo.currentlyEditingFieldIndex,
      newContent: editingValue
    })))
    void(dispatch(setCurrentlyEditingFieldIndex(
      {currentlyEditingFieldIndex: null})))
    setEditingValue("")
  }

  useEffect(() => {
    if (behaviourInfo.currentlySelectedLine !== null
      && behaviourInfo.currentlyEditingFieldIndex !== null) {
      const value = behaviourInfo.lines[behaviourInfo.currentlySelectedLine][behaviourInfo.currentlyEditingFieldIndex]
      setEditingValue(value)
    }
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
  const detectionInfo = useSelector(selectDetectionInfoPotentiallyNull)
  const defaultLayout = useSelector(selectBehaviourLayout)
  const dispatch = useAppDispatch()

  if (!videoFile || !detectionInfo) {
    return <div>Add video file and detection file first</div>
  }
  return <div>
    <button onClick={async () => {
      const fileHandleOrError = await valueOrErrorAsync(window.showSaveFilePicker)({
        id: "behaviouFile",
        startIn: "downloads",
        suggestedName: videoFile.file.name.endsWith(".mp4")
          ? videoFile.file.name.slice(0, -4) + ".csv" : undefined,
        types: [{description: "behave csv file", accept: {"text/csv": [".behave.csv"]}}],
      })
      if ("error" in fileHandleOrError) {
        return
      }
      dispatch(behaviourInfoCreatedNew({
        fileHandle: fileHandleOrError.value,
        layout: defaultLayout,
      }))}}>
      Create new behaviour file
    </button>
  </div>
}
export const Behaviour: FunctionComponent = () => {
  const behaviourInfo = useSelector(selectBehaviourInfo)

  return <div className={viewercss.behaviour}>
    {behaviourInfo ? <BehaviourEditor /> : <BehaviourCreator />}
  </div>
}
