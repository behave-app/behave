import { createAsyncThunk } from "@reduxjs/toolkit"
import type {ATConfig } from "./store"
import { selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./selectors"
import { behaviourInfoLineAdded, selectBehaviourInfo } from "./behaviourSlice"
import { assert } from "../lib/util"

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
    dispatch(behaviourInfoLineAdded({
      line: lineWithBehaviour, insertIndex: insertIndex!.index + 1}))
  }
)
