import { createAsyncThunk } from "@reduxjs/toolkit"
import type {ATConfig } from "./store"
import { selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./selectors"
import { addBehaviourInfoLine, behaviourInfoCreatedNew, behaviourInfoSavedAs, behaviourInfoSubjectUnselected, currentlySelectedLineUpdated, selectBehaviourInfo, toggleBehaviourInfoCurrentlySelectedSubject } from "./behaviourSlice"
import { assert, asyncSleep, valueOrErrorAsync } from "../lib/util"
import { selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut } from "./appSlice"
import { ShortcutsState } from "./shortcutsSlice"
import { CONTROLS, ValidControlName } from "./controls"
import { selectVideoFilePotentiallyNull } from "./videoFileSlice"
import { selectBehaviourLayout } from "./generalSettingsSlice"

export const addBehaviourLine = createAsyncThunk<
void, string , ATConfig
>(
  "behaviour/addBehaviourLine",
  async (behaviour , {getState, dispatch}) =>  {
    const state = getState()
    const insertLine = selectBehaviourLineWithoutBehaviour(state)
    assert(insertLine)
    const behaviourInfo = selectBehaviourInfo(state)
    assert(behaviourInfo)
    const insertIndex = selectSelectedBehaviourLine(state)!.index + 1
    const behaviourIndicesInLine = new Set(
      [...behaviourInfo.layout.entries()].filter(
        ([_, {type}]) => type === "behaviour")
        .map(([index]) => index))
    const lineWithBehaviour = insertLine.map(
      (word, index) => behaviourIndicesInLine.has(index) ? behaviour : word)
    dispatch(behaviourInfoSubjectUnselected())
    void(dispatch(addBehaviourInfoLine({
      line: lineWithBehaviour, insertIndex: insertIndex})).then(() => 
    dispatch(currentlySelectedLineUpdated(insertIndex))))
  }
)


export const executeShortcutAction = createAsyncThunk<
void, {
  action: string, shortcutsStateKey: keyof ShortcutsState
}, ATConfig
>(
  "shortcuts/handleKeyPress",
  async ({action, shortcutsStateKey} , {getState, dispatch}) =>  {
    const state = getState()
    switch (shortcutsStateKey) {
      case "generalShortcuts": {
        const controlInfo = CONTROLS[action as ValidControlName]
        if (controlInfo.selectIsDisabled(state)) {
          throw new Error("General action is disabled")
        }
        const actionparams = controlInfo.selectActionArgument(state)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        controlInfo.action(dispatch, actionparams as any)
      } break;
      case "subjectShortcuts": {
        if (!selectIsWaitingForSubjectShortcut(state)) {
          throw new Error("Subject action is disabled")
        }
        await dispatch(toggleBehaviourInfoCurrentlySelectedSubject(action))
      } break;
      case "behaviourShortcuts": {
        if (!selectIsWaitingForBehaviourShortcut(state)) {
          throw new Error("Behaviour action is disabled")
        }
        void(dispatch(addBehaviourLine(action)))

      } break;
      default: {
        const exhaust : never = shortcutsStateKey
        throw new Error("Exhausted " + exhaust)
      }
    }
  })


export const createNewBehaviourFileOrCreateWritable = createAsyncThunk<
void,
{action: "create" | "make writable"},
ATConfig
>(
  "behaviour/createNewBehaviourFileOrCreateWritable",
  async ({action}, {getState, dispatch}) => {
    const state = getState()
    const videoFile = selectVideoFilePotentiallyNull(state)
    const defaultLayout = selectBehaviourLayout(state)
    const behaviourInfo = selectBehaviourInfo(state)
    assert(videoFile)
    if (action === "make writable") {
      assert(behaviourInfo)
    }
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
      throw new Error("Interrupted")
    }
    if (action === "create") {
    dispatch(behaviourInfoCreatedNew({
      fileHandle: fileHandleOrError.value,
      layout: defaultLayout,
    }))
    } else {
      dispatch(behaviourInfoSavedAs({fileHandle: fileHandleOrError.value}))
    }
  })
