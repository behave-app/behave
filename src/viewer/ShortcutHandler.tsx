import { FunctionComponent } from "preact"
import { selectBehaviourShortcutMap, selectSubjectShortcutMap, selectVideoShortcutMap } from "./settingsSlice"
import { useSelector } from "react-redux"
import { Button } from "./PlayerInfo"
import { useEffect, useMemo, useState } from "react"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, areEqualKeys, keyToStrings } from "src/lib/key"
import { CONTROL_INFO_S, ControlInfo } from "./PlayerInfo"
import { behaviourInputSubjectToggle, behaviourInputSubjectUnselected, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, selectIsWaitingForVideoShortcut, selectShowKeyShortcutHelp } from "./appSlice"
import { behaviourInfoLineAdded, selectBehaviourInfo, selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./behaviourSlice"
import { videoPause } from "./videoPlayerSlice"
import * as css from "./shortcuthandler.module.css"
import { joinedStringFromDict } from "src/lib/util"

const createKeyDownEffect = (doAction: () => void, keyCombi: Key, disabled: boolean) => {
  return () => {
    if (disabled) {
      return
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      const pressedKey = keyFromEvent(ev)
      if (pressedKey === null) {
        return
      }
      if (!areEqualKeys(pressedKey, keyCombi)) {
        return
      }
      console.log("Doing action for " + keyToStrings(pressedKey).join("-"))
      doAction()
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }
}

function VideoShortcutKey<T>(
  {disabled, keyCombi, action}: {disabled: boolean, keyCombi: Key, action: keyof typeof CONTROL_INFO_S}
) {
  const dispatch = useAppDispatch()
  const [fired, setFired] = useState(false)
  const controlInfo = CONTROL_INFO_S[action] as ControlInfo<T>

  disabled = disabled || useSelector(controlInfo.selectIsDisabled)
  const actionArgument = useSelector(
    // this allows us to use selectors that would error when disabled = true
    disabled ? (() => undefined as T): controlInfo.selectActionArgument)

  const doAction = useMemo(() => () => {
    setFired(true)
    window.setTimeout(() => setFired(false), 0)
    controlInfo.action(dispatch, actionArgument)
  }, [dispatch, actionArgument, controlInfo])

  useEffect(createKeyDownEffect(doAction, keyCombi, disabled), [doAction, keyCombi, disabled])

  return <tr className={joinedStringFromDict({
    [css.disabled]: disabled,
    [css.fired]: fired
  })}>
    <td><button onClick={() => doAction()}>
      {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
    <td>
      <Button controlInfo={controlInfo} />
      {controlInfo.description}
    </td>
  </tr>
}

const SubjectShortcutKey: FunctionComponent<{disabled: boolean, keyCombi: Key, subject: string}> = ({disabled, keyCombi, subject}) => {
  const dispatch = useAppDispatch()
  const [fired, setFired] = useState(false)

  const doAction = useMemo(() => () => {
    setFired(true)
    window.setTimeout(() => setFired(false), 0)
    void(dispatch(videoPause()))
    dispatch(behaviourInputSubjectToggle(subject))
  }, [dispatch, subject])

  useEffect(createKeyDownEffect(doAction, keyCombi, disabled), [doAction, keyCombi, disabled])

  return <tr className={joinedStringFromDict({
    [css.disabled]: disabled,
    [css.fired]: fired
  })}>
    <td><button onClick={() => doAction()}>
      {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
    <td>
      {subject}
    </td>
  </tr>
}

function BehaviourShortcutKey(
  {disabled, keyCombi, behaviour}: {disabled: boolean, keyCombi: Key, behaviour: string}
) {
  const dispatch = useAppDispatch()
  const [fired, setFired] = useState(false)
  const line = useSelector(disabled ? () => null : selectBehaviourLineWithoutBehaviour)
  const insertIndex = useSelector(
    disabled ? () => null : selectSelectedBehaviourLine)
  const behaviourInfo = useSelector(selectBehaviourInfo)

  const doAction = useMemo(() => () => {
    if (!behaviourInfo || !line) {
      throw new Error("BehaviourInfo should not be null")
    }
    setFired(true)
    window.setTimeout(() => setFired(false), 0)
    const behaviourIndicesInLine = new Set(
      [...behaviourInfo.layout.entries()].filter(
        ([_, {type}]) => type === "behaviour")
        .map(([index]) => index))
    const lineWithBehaviour = line.map(
      (word, index) => behaviourIndicesInLine.has(index) ? behaviour : word)
    dispatch(behaviourInfoLineAdded({
      line: lineWithBehaviour, insertIndex: insertIndex!.index + 1}))
    dispatch(behaviourInputSubjectUnselected())
  }, [dispatch, behaviour, behaviourInfo, line, insertIndex])

  useEffect(createKeyDownEffect(doAction, keyCombi, disabled), [doAction, keyCombi, disabled])

  return <tr className={joinedStringFromDict({
    [css.disabled]: disabled,
    [css.fired]: fired
  })}>
    <td><button onClick={() => doAction()}>
      {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
    <td>
      {behaviour}
    </td>
  </tr>
}

export const ShortcutHandler: FunctionComponent = () => {
  const videoActive = useSelector(selectIsWaitingForVideoShortcut)
  const subjectActive = useSelector(selectIsWaitingForSubjectShortcut)
  const behaviourActive = useSelector(selectIsWaitingForBehaviourShortcut)
  const videoShortcuts = useSelector(selectVideoShortcutMap)
  const subjectShortcuts = useSelector(selectSubjectShortcutMap)
  const behaviourShortcuts = useSelector(selectBehaviourShortcutMap)
  const showKeyboardShortcuts = useSelector(selectShowKeyShortcutHelp)

  return <div className={joinedStringFromDict({
    [css.shortcuts]: true,
    [css.visible]: showKeyboardShortcuts,
  })}>
    <div>
      <h2>General shortcuts</h2>
      <table>
      <tbody>
      {[...videoShortcuts.values()].filter(({key}) => key).map(
        shortcut => <VideoShortcutKey disabled={!videoActive} keyCombi={shortcut.key!} action={shortcut.action} />)}
      </tbody>
      </table>
    </div>
    <div>
      <h2>Subject shortcuts</h2>
      <table>
      <tbody>
      {[...subjectShortcuts.values()].filter(({key}) => key).map(
        shortcut => <SubjectShortcutKey disabled={!subjectActive} keyCombi={shortcut.key!} subject={shortcut.action} />)}
      </tbody>
      </table>
    </div>
    <div>
      <h2>Behaviour shortcuts</h2>
      <table>
      <tbody>
      {[...behaviourShortcuts.values()].filter(({key}) => key).map(
        shortcut => <BehaviourShortcutKey disabled={!behaviourActive} keyCombi={shortcut.key!} behaviour={shortcut.action} />)}
      </tbody>
      </table>
    </div>
  </div>
}
