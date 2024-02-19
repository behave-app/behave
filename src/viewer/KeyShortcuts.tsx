import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, areEqualKeys, keyToStrings } from "../lib/key"
import { Button, } from "./Button"
import { CONTROLS, ControlInfo, ValidControlName } from "./controls"
import { behaviourInputSubjectToggle, behaviourInputSubjectUnselected, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import { behaviourInfoLineAdded, selectBehaviourInfo, } from "./behaviourSlice"
import { videoPause } from "./videoPlayerActions"
import * as css from "./keyshortcuts.module.css"
import { ObjectEntries, ObjectKeys, TSAssertType, assert, joinedStringFromDict } from "../lib/util"
import { selectBehaviourLineWithoutBehaviour, selectSelectedBehaviourLine } from "./selectors"
import { Icon, ValidIconName } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { KeyAlreadyInUseException, ShortcutsState, createOrUpdateShortcutKey, selectActiveGeneralShortcutGroup, shortcutKeyRemoved } from "./shortcutsSlice"
import { MODIFIER_KEYS } from "../lib/defined_keys"
import { SerializedError } from "@reduxjs/toolkit"

// const createKeyDownEffect = (doAction: () => void, keyCombi: Key, disabled: boolean) => {
//   return () => {
//     if (disabled) {
//       return
//     }
//     const onKeyDown = (ev: KeyboardEvent) => {
//       const pressedKey = keyFromEvent(ev)
//       if (pressedKey === null) {
//         return
//       }
//       if (!areEqualKeys(pressedKey, keyCombi)) {
//         return
//       }
//       doAction()
//     }
//     document.documentElement.addEventListener("keydown", onKeyDown)
//     return () => document.documentElement.removeEventListener("keydown", onKeyDown)
//   }
// }
//
// function VideoShortcutKey<T>(
//   {disabled, keyCombi, action}: {disabled: boolean, keyCombi: Key, action: ValidControlName}
// ) {
//   const dispatch = useAppDispatch()
//   const [fired, setFired] = useState(false)
//   const controlInfo = CONTROLS[action] as ControlInfo<T>
//
//   disabled = disabled || useSelector(controlInfo.selectIsDisabled)
//   const actionArgument = useSelector(
//     // this allows us to use selectors that would error when disabled = true
//     disabled ? (() => undefined as T): controlInfo.selectActionArgument)
//
//   const doAction = useMemo(() => () => {
//     setFired(true)
//     window.setTimeout(() => setFired(false), 0)
//     controlInfo.action(dispatch, actionArgument)
//   }, [dispatch, actionArgument, controlInfo])
//
//   useEffect(createKeyDownEffect(doAction, keyCombi, disabled), [doAction, keyCombi, disabled])
//
//   return <tr className={joinedStringFromDict({
//   })}>
//     <td><button onClick={() => doAction()}>
//       {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
//     <td>
//       <Button controlInfo={controlInfo} />
//       {controlInfo.description}
//     </td>
//   </tr>
// }
//
// const SubjectShortcutKey: FunctionComponent<{disabled: boolean, keyCombi: Key, subject: string}> = ({disabled, keyCombi, subject}) => {
//   const dispatch = useAppDispatch()
//   const [fired, setFired] = useState(false)
//
//   const doAction = useMemo(() => () => {
//     setFired(true)
//     window.setTimeout(() => setFired(false), 0)
//     void(dispatch(videoPause()))
//     dispatch(behaviourInputSubjectToggle(subject))
//   }, [dispatch, subject])
//
//   useEffect(createKeyDownEffect(doAction, keyCombi, disabled), [doAction, keyCombi, disabled])
//
//   return <tr className={joinedStringFromDict({
//   })}>
//     <td><button onClick={() => doAction()}>
//       {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
//     <td>
//       {subject}
//     </td>
//   </tr>
// }
//
// function BehaviourShortcutKey(
//   {disabled, keyCombi, behaviour}: {disabled: boolean, keyCombi: Key, behaviour: string}
// ) {
//   const dispatch = useAppDispatch()
//   const [fired, setFired] = useState(false)
//   const line = useSelector(disabled ? () => null : selectBehaviourLineWithoutBehaviour)
//   const insertIndex = useSelector(
//     disabled ? () => null : selectSelectedBehaviourLine)
//   const behaviourInfo = useSelector(selectBehaviourInfo)
//
//   const doAction = useMemo(() => () => {
//     if (!behaviourInfo || !line) {
//       throw new Error("BehaviourInfo should not be null")
//     }
//     setFired(true)
//     window.setTimeout(() => setFired(false), 0)
//     const behaviourIndicesInLine = new Set(
//       [...behaviourInfo.layout.entries()].filter(
//         ([_, {type}]) => type === "behaviour")
//         .map(([index]) => index))
//     const lineWithBehaviour = line.map(
//       (word, index) => behaviourIndicesInLine.has(index) ? behaviour : word)
//     dispatch(behaviourInfoLineAdded({
//       line: lineWithBehaviour, insertIndex: insertIndex!.index + 1}))
//     dispatch(behaviourInputSubjectUnselected())
//   }, [dispatch, behaviour, behaviourInfo, line, insertIndex])
//
//   useEffect(createKeyDownEffect(doAction, keyCombi, disabled), [doAction, keyCombi, disabled])
//
//   return <tr className={joinedStringFromDict({
//   })}>
//     <td><button onClick={() => doAction()}>
//       {keyToStrings(keyCombi).map(k => <kbd>{k}</kbd>)}</button></td>
//     <td>
//       {behaviour}
//     </td>
//   </tr>
// }
//
type ControlShortcutEditPopupProps<T extends keyof ShortcutsState> = {
  shortcutsStateKey: T
  action: T extends "generalShortcuts" ? ValidControlName : string
  onRequestClose: () => void
  title: string
  iconName: ValidIconName
  disabled: boolean
  activated: boolean
  keys: ReadonlyArray<Key>
}

const keyToStringsSpecial = (key: Partial<Key>): string[] => {
  const codeMissing = !("code" in key)
  const newKey = (codeMissing ? {...key, code: "KeyA" as const} : {...key}) as Key
  const strings = keyToStrings(newKey)
  return codeMissing ? strings.slice(0, -1) : strings
}

function ControlShortcutEditPopup<T extends keyof ShortcutsState>(
  {
    shortcutsStateKey, action, onRequestClose, disabled, activated, keys,
  }: ControlShortcutEditPopupProps<T>
) {
  const dispatch = useAppDispatch()
  const [editKeyInfo, setEditKeyInfo] = useState<null | ({
    index: number,
    key: {modifiers?: Key["modifiers"], code?: Key["code"]},
  } & ({
    state: "doing"
  } | {
    state: "error"
    error: SerializedError | KeyAlreadyInUseException
  }))>(null)

  const editKeyInfoRef = useRef(editKeyInfo)
  
  useEffect(() => {
    editKeyInfoRef.current = editKeyInfo
  }, [editKeyInfo])

  const trySaveNewKey = useCallback((key: Key) => {
    const editKeyInfo = editKeyInfoRef.current
    assert(editKeyInfo)
    dispatch(createOrUpdateShortcutKey({
      stateKey: shortcutsStateKey,
      action,
      newKey: key,
      oldKey: keys[editKeyInfo.index]
    })).unwrap().then((res) => {
        console.log(res)
        setEditKeyInfo(null)
      }).catch((error) => {
        setEditKeyInfo(editKeyInfo => {
          if (editKeyInfo?.state !== "doing") {
            return editKeyInfo
          }
          return {
            ...editKeyInfo,
            key,
            state: "error",
            error,
          }
        })
      })
  }, [])


  const editKeyInfoState = editKeyInfo?.state
  useEffect(() => {
    if (editKeyInfoState !== "doing") {
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const key = keyFromEvent(e)
      if (e.code === "Escape") {
        setEditKeyInfo(null)
        e.stopPropagation()
        e.preventDefault()
        return
      }
      if (key) {
        trySaveNewKey(key)
      } else {
        setEditKeyInfo(editKeyInfo => {
          if (editKeyInfo?.state !== "doing") {
            return editKeyInfo
          }
          return {
            ...editKeyInfo,
            key: {
              modifiers: ObjectKeys(MODIFIER_KEYS).filter(key => e[key])
            }
          }
        })
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      setEditKeyInfo(editKeyInfo => {
        if (editKeyInfo?.state !== "doing") {
          return editKeyInfo
        }
        return {
          ...editKeyInfo,
          key: {
            modifiers: ObjectKeys(MODIFIER_KEYS).filter(key => e[key])
          }
        }
      })
    }
    document.documentElement.addEventListener("keyup", onKeyUp)
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => {
      document.documentElement.removeEventListener("keyup", onKeyUp)
      document.documentElement.removeEventListener("keydown", onKeyDown)
    }

  }, [editKeyInfo, trySaveNewKey])

  const keysWithEdit = [...keys] as (Key | "edit")[]
  if (editKeyInfo) {
    keysWithEdit[editKeyInfo.index] = "edit"
  }

  const title = shortcutsStateKey === "generalShortcuts"
  ? CONTROLS[action as ValidControlName].description : action
  const iconName = shortcutsStateKey === "generalShortcuts"
  ? CONTROLS[action as ValidControlName].iconName :null
  return <Dialog className={css.edit_dialog} blur onRequestClose={onRequestClose}>
    <h2>
      {iconName && <span className={css.icon}><Icon iconName={iconName} /></span>}
      {title}
    </h2>
    <h3>Status</h3>
    <div>
      {disabled && "[disabled]"} {activated && "[active]"}
      {!(disabled || activated) && "normal"}
    </div>
    <h3>Shortcut keys</h3>
    <div className={joinedStringFromDict({[css.shortcuts]: true})}>
      {keys.length ? <div>
        {keysWithEdit.map(
          (key, index) => <div className={joinedStringFromDict({
            [css.shortcut_row]: true,
            [css.editing_key]: key === "edit",
          })}>
            <div className={css.shortcut_key}>
              {keyToStringsSpecial(
                key === "edit" ? editKeyInfo!.key : key).map(
                  singleKey => <kbd>{singleKey}</kbd>)}
            </div>
            <button 
              onClick={() => setEditKeyInfo(key === "edit" ? null : {
                index, state: "doing", key: {}})}>
              <Icon iconName="edit" />
            </button>
            <button 
              onClick={() => dispatch(shortcutKeyRemoved(key as Key))}>
              <Icon iconName="delete" />
            </button>
          </div>)}
      </div> : "No shortcuts defined"}
    </div>
    <div className={css.button_row}>
      <button onClick={() => setEditKeyInfo({
        index: keys.length, state: "doing", key: {}})} >
        <Icon iconName="add" /> Add shortcut
      </button>
      <button onClick={onRequestClose}>Close</button>
    </div>
    {editKeyInfo?.state == "error" && <Dialog blur type="error"
      className={css.error_popup}
      onRequestClose={() => setEditKeyInfo(null)}>
      {"stateKey" in editKeyInfo.error ? <>
        <h2>Key already in use</h2>
        <div>
          This key is already in use as a shortcut {
            editKeyInfo.error.stateKey === "generalShortcuts"
              ? <>to <em>{CONTROLS[editKeyInfo.error.action as ValidControlName].description}</em>.</>
              : <>for the {editKeyInfo.error.stateKey === "subjectShortcuts"
                ? "subject" : "behaviour"} <em>{editKeyInfo.error.action}</em>.</>}
        </div>
        <div>
          Every key can only be assigned to a single action.
          Below you have a choice to either cancel the edit,
          or delete the other keybinding and reassign {
            keyToStrings(editKeyInfo.error.key).map(
              singleKey => <kbd>{singleKey}</kbd>)} to <em>{title}</em>.
        </div>
        <button onClick={() => setEditKeyInfo(null)}>cancel</button>
        <button onClick={((key) => () =>{
          dispatch(shortcutKeyRemoved(key));
          trySaveNewKey(key);
        })(editKeyInfo.error.key)}>reassign</button>
      </> : <>
          <h2>Something went wrong</h2>
          <div>
            You should not see this screen, please report.
            <blockquote>{editKeyInfo.error.message}</blockquote>
          </div>
          <button onClick={() => setEditKeyInfo(null)}>close</button>
        </>
      }
    </Dialog>
    }
  </Dialog>
}


const ControlShortcut: FunctionComponent<{controlKey: ValidControlName}> = (
  {controlKey}
) => {
  const generalShortcutsByAction = useSelector(selectActiveGeneralShortcutGroup)
  const controlInfo = CONTROLS[controlKey]
  const keys = generalShortcutsByAction.shortcuts[controlKey] ?? []
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
      title={controlInfo.description + (keys.length ? " (shortcut: "
        + keys.map(key => keyToStrings(key).join("-")).map(k => "`" + k + "`").join(", ")
        + ")": "") + (disabled ? " [disabled]" : "") + (activated ? " [active]" : "")}>
      <Icon iconName={controlInfo.iconName} />
      <div className={css.description}>{controlInfo.description}</div>
      <div className={css.keys}>
        {keys.map(key => <div className={css.key}>{keyToStrings(key).map(
          singleKey => <kbd>{singleKey}</kbd>)}</div>)}
      </div>
    </button>
    <button className={css.show_on_hover} onClick={() => setEditPopup(true)}><Icon iconName="edit" /></button>
    {editPopup && <ControlShortcutEditPopup
    onRequestClose={() => setEditPopup(false)}
    shortcutsStateKey="generalShortcuts"
    action={controlKey}
    disabled={disabled}
    activated={activated}
    keys={keys}
    title={controlInfo.description}
    iconName={controlInfo.iconName}
    />}
  </div>
}

export const KeyShortcuts: FunctionComponent = () => {
  return <div>
    <div>
      <h2>General shortcuts</h2>
      <div className={css.shortcut_list}>
        {Object.keys(CONTROLS).map((key) => <ControlShortcut controlKey={key as ValidControlName} />)}
        </div>
      </div>
  </div>
}
