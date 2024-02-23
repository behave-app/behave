import { createAsyncThunk } from "@reduxjs/toolkit"
import type {ATConfig } from "./store"
import { selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./selectors"
import { behaviourInfoLineAdded, selectBehaviourInfo } from "./behaviourSlice"
import { assert } from "../lib/util"
import { behaviourInputSubjectToggle, behaviourInputSubjectUnselected, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut } from "./appSlice"
import { ShortcutsState } from "./shortcutsSlice"
import { CONTROLS, ValidControlName } from "./controls"

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
    const insertIndex = selectSelectedBehaviourLine(state)
    const behaviourIndicesInLine = new Set(
      [...behaviourInfo.layout.entries()].filter(
        ([_, {type}]) => type === "behaviour")
        .map(([index]) => index))
    const lineWithBehaviour = insertLine.map(
      (word, index) => behaviourIndicesInLine.has(index) ? behaviour : word)
    dispatch(behaviourInputSubjectUnselected())
    dispatch(behaviourInfoLineAdded({
      line: lineWithBehaviour, insertIndex: insertIndex!.index + 1}))
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
        dispatch(behaviourInputSubjectToggle(action))
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
