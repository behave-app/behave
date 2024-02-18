import { FunctionComponent } from "preact"
import { selectBehaviourShortcutMap, selectGeneralShortcutsByAction, selectSubjectShortcutMap, selectVideoShortcutMap } from "./settingsSlice"
import { useSelector } from "react-redux"
import { useEffect, useMemo, useState } from "react"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, areEqualKeys, keyToStrings } from "../lib/key"
import { Button, } from "./Button"
import { CONTROLS, ControlInfo, ValidControlName } from "./controls"
import { behaviourInputSubjectToggle, behaviourInputSubjectUnselected, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import { behaviourInfoLineAdded, selectBehaviourInfo, } from "./behaviourSlice"
import { videoPause } from "./videoPlayerActions"
import * as css from "./keyshortcuts.module.css"
import { TSAssertType, joinedStringFromDict } from "../lib/util"
import { selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./selectors"
import { Icon } from "src/lib/Icon"
import { Dialog } from "src/lib/Dialog"

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
      doAction()
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }
}

function VideoShortcutKey<T>(
  {disabled, keyCombi, action}: {disabled: boolean, keyCombi: Key, action: ValidControlName}
) {
  const dispatch = useAppDispatch()
  const [fired, setFired] = useState(false)
  const controlInfo = CONTROLS[action] as ControlInfo<T>

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
  })}>
    <td><button onClick={() => doAction()}>
      {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
    <td>
      {behaviour}
    </td>
  </tr>
}

const ControlShortcut: FunctionComponent<{controlKey: ValidControlName}> = (
  {controlKey}
) => {
  const generalShortcutsByAction = useSelector(selectGeneralShortcutsByAction)
  const controlInfo = CONTROLS[controlKey]
  const shortcuts = generalShortcutsByAction.get(controlKey) ?? []
  const disabled = useSelector(controlInfo.selectIsDisabled)
  const activated = useSelector(controlInfo.selectIsActivated)
// eslint-disable-next-line @typescript-eslint/no-explicit-any  -- can fix by making this function a generic
  const actionArgument: any = useSelector(controlInfo.selectActionArgument)
  const dispatch = useAppDispatch()
  const [editPopup, setEditPopup] = useState(false)

  return <div className={joinedStringFromDict({
    [css.item]: true,
    [css.show_on_hover_buttons]: true,
  })}>
    <button disabled={disabled}
      className={joinedStringFromDict({
        [css.activated]: activated,
        [css.button]: true,
      })}
      onClick={() => {if (!disabled) {
        controlInfo.action(dispatch, actionArgument)}}}
      title={controlInfo.description + (shortcuts.length ? " (shortcut: "
        + shortcuts.map(key => keyToStrings(key).join("-")).map(k => "`" + k + "`").join(", ")
        + ")": "") + (disabled ? " [disabled]" : "") + (activated ? " [active]" : "")}>
      <Icon iconName={controlInfo.iconName} />
      <div className={css.description}>{controlInfo.description}</div>
      <div className={css.keys}>
        {shortcuts.map(k => <div className={css.key}>{keyToStrings(k).map(
          singleKey => <kbd>{singleKey}</kbd>)}</div>)}
      </div>
    </button>
    <button className={css.show_on_hover} onClick={() => setEditPopup(true)}><Icon iconName="edit" /></button>
    {editPopup && <Dialog className={css.edit_dialog} blur onRequestClose={() => setEditPopup(false)}>
      <h2>
        <span className={css.icon}><Icon iconName={controlInfo.iconName} /></span>
        {controlInfo.description}
      </h2>
      <h3>Status</h3>
      <div>
        {disabled && "[disabled]"} {activated && "[active]"}
        {!(disabled || activated) && "normal"}
      </div>
      <h3>Shortcut keys</h3>
      <div className={css.shortcuts}>
        {shortcuts.length ? <ul>
          {shortcuts.map(shortcut => <li className={css.show_on_hover_buttons}>
            <div>
              {keyToStrings(shortcut).map(singleKey => <kbd>{singleKey}</kbd>)}
            </div>
            <button className={css.show_on_hover}><Icon iconName="edit" /></button>
            <button className={css.show_on_hover}><Icon iconName="delete" /></button>
          </li>)}
        </ul> : "No shortcuts defined"}
        <button><Icon iconName="add" /> Add shortcut</button>
      </div>
    </Dialog>}
  </div>
}

export const KeyShortcuts: FunctionComponent = () => {
  const subjectActive = useSelector(selectIsWaitingForSubjectShortcut)
  const behaviourActive = useSelector(selectIsWaitingForBehaviourShortcut)
  const videoShortcuts = useSelector(selectVideoShortcutMap)
  const subjectShortcuts = useSelector(selectSubjectShortcutMap)
  const behaviourShortcuts = useSelector(selectBehaviourShortcutMap)
  const generalShortcutsByAction = useSelector(selectGeneralShortcutsByAction)

  return <div>
    <div>
      <h2>General shortcuts</h2>
      <div className={css.shortcut_list}>
        {Object.keys(CONTROLS).map((key) => <ControlShortcut controlKey={key as ValidControlName} />)}
        </div>
      </div>
  </div>
}
