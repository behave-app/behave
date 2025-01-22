import { FunctionComponent } from "preact"
import * as viewercss from "./viewer.module.css"
import { useSelector } from "react-redux"
import { behaviourInfoCreatedNew, editBehaviourInfoLineField, setCurrentlyEditing, currentlySelectedLineUnset, currentlySelectedLineUpdated, selectBehaviourInfo, behaviourInfoSubjectUnselected, } from "./behaviourSlice"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectBehaviourLayout, selectFramenumberIndexInLayout } from "./generalSettingsSlice"
import { useAppDispatch } from "./store"
import { useEffect, useRef, useState } from "react"
import * as css from "./behaviour.module.css"
import { selectBehaviourLineWithoutBehaviour, selectCurrentFrameNumber, selectSelectedBehaviourLine } from "./selectors"
import { videoSeekToFrameNumberAndPause } from "./videoPlayerActions"
import { keyFromEvent, keyToString, keyToStrings } from "../lib/key"
import { ObjectEntries, asyncSleep, getDuplicateIndices, mayBeUndefined, valueOrErrorAsync } from "../lib/util"
import { Icon } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { selectActiveBehaviourShortcutPreset, selectActiveSubjectShortcutPreset } from "./shortcutsSlice"

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
      && behaviourInfo.currentlyEditing === null
      && currentFrameNumber !== parseInt(
        (behaviourInfo.lines[behaviourInfo.currentlySelectedLine] ?? [])[frameNumberIndexInLayout])
    ) {
      dispatch(currentlySelectedLineUnset())
    }
  }, [currentFrameNumber, behaviourInfo.currentlyEditing])

  const startEditingField = (
    lineNumber: number, fieldIndex: number,
    type: "subject" | "behaviour" | "free") => {
    if (lineNumber === 0) {
      console.warn("Not allowed editing the header line")
      return 
    }
    if (insertLine) {
      dispatch(behaviourInfoSubjectUnselected())
    }
    if (fieldIndex === frameNumberIndexInLayout) {
      console.warn("Frame number field not editable")
      return
    }
    if (type !== "free" && behaviourInfo.layout[fieldIndex].type !== type) {
      console.warn(`Editing ${behaviourInfo.layout[fieldIndex].type} field '
        + 'as ${type}`)
      return

    }
    if (behaviourInfo.currentlyEditing !== null) {
      saveEdit()
    }
    const newFrameNumber = parseInt(
      (behaviourInfo.lines[lineNumber] ?? [])[frameNumberIndexInLayout])
    if (!isNaN(newFrameNumber)) {
      void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
    }
    setEditingValue(behaviourInfo.lines[lineNumber][fieldIndex])
    void(dispatch(setCurrentlyEditing({
      currentlyEditing: {fieldIndex, type},
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
      || behaviourInfo.currentlyEditing === null) {
      return
    }
    const key = keyFromEvent(event)
    if (key === null) {
      if (event.code === "Escape") {
        event.stopPropagation()
        void(dispatch(setCurrentlyEditing({currentlyEditing: null})))

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
      || behaviourInfo.currentlyEditing === null) {
      return
    }
    void(dispatch(editBehaviourInfoLineField({
      lineNumber: behaviourInfo.currentlySelectedLine!,
      fieldIndex: behaviourInfo.currentlyEditing.fieldIndex,
      newContent: editingValue
    })))
    void(dispatch(setCurrentlyEditing({currentlyEditing: null})))
    setEditingValue("")
  }

  useEffect(() => {
    if (behaviourInfo.currentlySelectedLine !== null
      && behaviourInfo.currentlyEditing !== null
      && behaviourInfo.currentlyEditing.type === "free") {
      const value = behaviourInfo.lines[behaviourInfo.currentlySelectedLine][behaviourInfo.currentlyEditing.fieldIndex]
      setEditingValue(value)
    }
    if (inputElementRef.current) {
      inputElementRef.current.focus()
    }
  }, [behaviourInfo.currentlyEditing?.type, behaviourInfo.currentlySelectedLine])

  return <><table className={css.table}
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
          {line.map((item, fieldIndex) => {
            const type = behaviourInfo.layout[fieldIndex].type
            return <td><span>
              {fieldIndex !== frameNumberIndexInLayout
                && behaviourInfo.currentlySelectedLine === index
                && behaviourInfo.currentlyEditing !== null
                && behaviourInfo.currentlyEditing.fieldIndex === fieldIndex
                && behaviourInfo.currentlyEditing.type === "free"
                ? <input ref={inputElementRef} onKeyDown={editFieldKeyDown}
                  onInput={
                  e => setEditingValue((e.target as HTMLInputElement).value)}
                  onBlur={() => saveEdit()}
                  value={editingValue} />
                : <>
                  <span
                    onClick={() => selectLine(index)}
                    onDblClick={() => startEditingField(index, fieldIndex, "free")}
                  >
                    {item}
                  </span>
                  {index !== 0
                    && (type === "subject" || type === "behaviour")
                    && <span className={css.dropdown}
                      onClick={() => {
                        startEditingField(index, fieldIndex, type)
                      }}>
                      <Icon iconName="arrow_drop_down" />
                    </span>}
                </>
              }
            </span></td>
          })}
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
    {behaviourInfo.currentlyEditing !== null
      && behaviourInfo.currentlyEditing.type !== "free"
      && <DropDownSelect
        type={behaviourInfo.currentlyEditing.type}
        onRequestClose={() => 
        void(dispatch(setCurrentlyEditing({currentlyEditing: null})))} />}
  </>
}

type DropDownSelectProps = {
  type: "subject" | "behaviour",
  onRequestClose: () => void
}

const DropDownSelect: FunctionComponent<DropDownSelectProps> = (
  {type, onRequestClose}) => {
  const behaviourInfo = useSelector(selectBehaviourInfo)!
  const dispatch = useAppDispatch()
  const subjects = useSelector(type === "subject" ?
    selectActiveSubjectShortcutPreset : selectActiveBehaviourShortcutPreset)

  const actionKeyPairs = ObjectEntries(subjects.shortcuts).flatMap(
  ([action, keys]) => keys.map(key => [action, key] as const))
  const duplicates = new Set(getDuplicateIndices(actionKeyPairs.map(
    ak => keyToString(ak[1]))).flat())


  // Note this will overwrite the former key with the latter if there are duplicates
  const actionByKey = Object.fromEntries(
    actionKeyPairs.filter((_, index) => !duplicates.has(index))
      .map(([action, key]) => [keyToString(key), action]))

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = keyFromEvent(e)
      if (key === null) {
        return;
      }
      const selectedAction = mayBeUndefined(actionByKey[keyToString(key)])
      if (selectedAction) {
        e.preventDefault()
        saveAction(selectedAction)
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [subjects])

  const saveAction = (action: string) => {
    if (behaviourInfo.currentlySelectedLine === null
      || behaviourInfo.currentlyEditing === null) {
      return
    }
    void(dispatch(editBehaviourInfoLineField({
      lineNumber: behaviourInfo.currentlySelectedLine!,
      fieldIndex: behaviourInfo.currentlyEditing.fieldIndex,
      newContent: action,
    })))
    void(dispatch(setCurrentlyEditing({currentlyEditing: null})))
  }

  return <Dialog onRequestClose={onRequestClose} className={css.subject_behaviour_picker}>
    {ObjectEntries(subjects.shortcuts).map(([action, keys]) =>
      <button title={action + (keys.length ? " (shortcut: "
        + keys.map(key => keyToStrings(key).join("-")).map(k => "`" + k + "`").join(", ")
        + ")": "")}
        onClick={() => saveAction(action)}>
        <Icon iconName={type === "subject" ? "cruelty_free" : "sprint"} />
        {action}
      </button>
    )}
  </Dialog>
}

const BehaviourCreator: FunctionComponent = () => {
  const videoFile = useSelector(selectVideoFilePotentiallyNull)
  const defaultLayout = useSelector(selectBehaviourLayout)
  const dispatch = useAppDispatch()

  if (!videoFile) {
    return <div>Add video file and detection file first</div>
  }
  return <div>
    <button onClick={async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        await asyncSleep(1000)
      }
      const fileHandleOrError = await valueOrErrorAsync(window.showSaveFilePicker)({
        id: "behaviouFile",
        startIn: "downloads",
        suggestedName: videoFile.file.name.endsWith(".mp4")
          ? videoFile.file.name.slice(0, -4) + ".csv" : undefined,
        types: [{description: "behave csv file", accept: {"text/csv": [".behave.csv"]}}],
      })
      if ("error" in fileHandleOrError) {
        if ((fileHandleOrError.error as DOMException).name === "AbortError") {
          console.warn("Save file selection cancelled, not creating behaviour file")
          return
        }
        throw(fileHandleOrError.error)
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
