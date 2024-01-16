import { FunctionComponent } from "preact"
import { selectActiveShortcuts } from "./settingsSlice"
import { useSelector } from "react-redux"
import { useEffect } from "react"
import { store, useAppDispatch } from "./store"
import { keyFromEvent, keyToString } from "src/lib/key"
import { CONTROL_INFO_S, makeSelector } from "./PlayerInfo"
import { behaviourInputSubjectToggle, behaviourInputSubjectUnselected, selectSelectedSubject } from "./appSlice"
import { behaviourInfoLineAdded, selectBehaviourInfo, selectBehaviourInfoLinesInsertIndexForCurrentFrame, selectBehaviourLineWithoutBehaviour } from "./behaviourSlice"
import { videoPause } from "./videoPlayerSlice"

export const ShortcutHandler: FunctionComponent = () => {
  const activeShortcuts = useSelector(selectActiveShortcuts)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const keyObject = keyFromEvent(ev)
      if (keyObject === null) {
        return
      }
      const keyString = keyToString(keyObject)
      if (!activeShortcuts.has(keyString)) {
        return
      }
      const {key: _key, type, action} = activeShortcuts.get(keyString)!
      const state = store.getState()  // TODO fix this
      if (type === "video") {
        const control = CONTROL_INFO_S[action]
        if (makeSelector(control.selectIsDisabled, true)(state)) {
          console.log(`Video action ${action} is currently disabled`)
          return
        }
        control.action(dispatch)
      } else if (type === "subject") {
        void(dispatch(videoPause()))
        dispatch(behaviourInputSubjectToggle(action))
      } else if (type === "behaviour") {
        if (!selectSelectedSubject) {
          throw new Error("Behaviour without subject")
        }
        const behaviourInfo = selectBehaviourInfo(state)
        if (!behaviourInfo) {
          throw new Error("This should not happen")
        }
        const behaviourLine = selectBehaviourLineWithoutBehaviour(state)
        if (!behaviourLine) {
          throw new Error("Should have behaviour line")
        }
        [...behaviourInfo.layout.entries()].filter(
          ([_, {type}]) => type === "behaviour")
          .forEach(([index]) => {behaviourLine[index] = action})
        const insertIndex = selectBehaviourInfoLinesInsertIndexForCurrentFrame(
          state)
        dispatch(behaviourInfoLineAdded({line: behaviourLine, insertIndex}))
        dispatch(behaviourInputSubjectUnselected())
      } else {
        throw new Error("Unknown shortcut")
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [activeShortcuts])
  return <></>
}

