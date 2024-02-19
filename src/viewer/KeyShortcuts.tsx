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
import { KeyAlreadyInUseException, ShortcutGroup, ShortcutsState, createOrUpdateShortcutKey, selectActiveBehaviourShortcutGroup, selectActiveGeneralShortcutGroup, selectActiveSubjectShortcutGroup, shortcutKeyRemoved } from "./shortcutsSlice"
import { MODIFIER_KEYS } from "../lib/defined_keys"
import { SerializedError } from "@reduxjs/toolkit"
import type { RootState } from "./store"
import { addBehaviourLine } from "./reducers"

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
const keyToStringsSpecial = (key: Partial<Key>): string[] => {
  const codeMissing = !("code" in key)
  const newKey = (codeMissing ? {...key, code: "KeyA" as const} : {...key}) as Key
  const strings = keyToStrings(newKey)
  return codeMissing ? strings.slice(0, -1) : strings
}

type ControlShortcutEditPopupProps<T extends keyof ShortcutsState> = {
  shortcutsStateKey: T
  action: T extends "generalShortcuts" ? ValidControlName : string
  onRequestClose: () => void
  disabled: boolean
  activated: boolean
  keys: ReadonlyArray<Key>
  title: string
  iconName: ValidIconName
}


function ControlShortcutEditPopup<T extends keyof ShortcutsState>(
  {
    shortcutsStateKey, action, onRequestClose, disabled, activated, keys,
    title, iconName,
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

type ControlShortcutProps<T extends keyof ShortcutsState> = {
  shortcutsStateKey: T
  action: T extends "generalShortcuts" ? ValidControlName : string
  onRequestClose: () => void
}

function ControlShortcut<T extends keyof ShortcutsState>(
  {shortcutsStateKey, action, onRequestClose}: ControlShortcutProps<T>
) {
  const shortcutsGroup = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutGroup
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutGroup
    : selectActiveBehaviourShortcutGroup) as ShortcutGroup<T extends "generalShortcuts" ? ValidControlName : string>
  const keys = shortcutsGroup.shortcuts[action] ?? []
  const controlInfo = shortcutsStateKey === "generalShortcuts"
    ? CONTROLS[action as ValidControlName] : null

  const disabled = useSelector(
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.selectIsDisabled
    : shortcutsStateKey === "subjectShortcuts"
    ? (state: RootState) => !selectIsWaitingForSubjectShortcut(state)
    : (state: RootState) => !selectIsWaitingForBehaviourShortcut(state))

  const activated = useSelector(controlInfo?.selectIsActivated ?? (() => false))

// eslint-disable-next-line @typescript-eslint/no-explicit-any  -- can fix by making this function a generic
  const actionArgument: any = useSelector(
    controlInfo?.selectActionArgument ?? (() => undefined))
  const dispatch = useAppDispatch()
  const [editPopup, setEditPopup] = useState(false)

  const title = controlInfo ? controlInfo.description : action
  const iconName: ValidIconName = (
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.iconName
      : shortcutsStateKey === "subjectShortcuts" ? "cruelty_free"
        : "sprint")

  const dispatchAction = async () => {
    if (disabled) {
      return;
    }
    switch (shortcutsStateKey) {
      case "generalShortcuts":
        controlInfo!.action(dispatch, actionArgument)
        break
      case "subjectShortcuts":
        dispatch(behaviourInputSubjectToggle(action))
        break
      case "behaviourShortcuts":
        void(dispatch(addBehaviourLine(action)))
        break
      default:
      {
          const exhaust : never = shortcutsStateKey
          throw new Error(`Exhausted: ${exhaust}`)
      }
    }
    onRequestClose()
  }

  return <div className={joinedStringFromDict({
    [css.item]: true,
    [css.show_on_hover_buttons]: true,
  })}>
    <button disabled={disabled}
      className={joinedStringFromDict({
        [css.activated]: activated,
        [css.button]: true,
      })}
      onClick={() => dispatchAction}
      title={title + (keys.length ? " (shortcut: "
        + keys.map(key => keyToStrings(key).join("-")).map(k => "`" + k + "`").join(", ")
        + ")": "") + (disabled ? " [disabled]" : "") + (activated ? " [active]" : "")}>
      <Icon iconName={iconName} />
      <div className={css.description}>{title}</div>
      <div className={css.keys}>
        {keys.map(key => <div className={css.key}>{keyToStrings(key).map(
          singleKey => <kbd>{singleKey}</kbd>)}</div>)}
      </div>
    </button>
    <button className={css.show_on_hover} onClick={() => setEditPopup(true)}><Icon iconName="edit" /></button>
    {editPopup && <ControlShortcutEditPopup
    onRequestClose={() => setEditPopup(false)}
    shortcutsStateKey={shortcutsStateKey}
    action={action}
    disabled={disabled}
    activated={activated}
    keys={keys}
    title={title}
    iconName={iconName}
    />}
  </div>
}

type ShortcutListProps = {
  onRequestClose: () => void
  shortcutsStateKey: keyof ShortcutsState
}

type ActionType<T extends keyof ShortcutsState> = T extends "generalShortcuts" ? ValidControlName : string

const ShortcutList: FunctionComponent<ShortcutListProps> = (
  {onRequestClose, shortcutsStateKey}
) => {
  const shortcuts: Record<ActionType<typeof shortcutsStateKey>, unknown> = useSelector(
    (state: RootState) => shortcutsStateKey === "generalShortcuts" ? CONTROLS
  : shortcutsStateKey === "subjectShortcuts"
      ? selectActiveSubjectShortcutGroup(state).shortcuts
      : selectActiveBehaviourShortcutGroup(state).shortcuts
  )

  const subjectDisabledLine = <>All subjects are disabled at the moment. Subjects can only be chosen when a Behaviour file was opened in edit mode.</>
  const behaviourDisabledLine = <>All behaviours are disabled at the moment. Behaviours can only be chosen after a subject is chosen. If you want a line without a subject (and only behaviour), create a subject with an empty string.</>


  const intro = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts" ? null
    : shortcutsStateKey === "subjectShortcuts"
    ? (selectIsWaitingForSubjectShortcut(state) ? null : subjectDisabledLine)
    : (selectIsWaitingForBehaviourShortcut(state) ? null : behaviourDisabledLine)
  )

  return <div>
      <h2>{shortcutsStateKey === "generalShortcuts" ? "General"
    : shortcutsStateKey === "subjectShortcuts" ? "Subject"
    : "Behaviour"} shortcuts</h2>
      {intro && <div className={css.intro}>{intro}</div>}
      <div className={css.shortcut_list}>
        {ObjectKeys(shortcuts).map((action) => <ControlShortcut
          action={action}
          shortcutsStateKey={shortcutsStateKey}
          onRequestClose={onRequestClose}
        />)}
        </div>
      </div>
}

type Props = {
  onRequestClose: () => void
}

export const KeyShortcuts: FunctionComponent<Props> = ({onRequestClose}) => {
  const shortcutsStateKeys: (keyof ShortcutsState)[] = ["generalShortcuts", "subjectShortcuts", "behaviourShortcuts"]
  return <div>
    {shortcutsStateKeys.map(
      shortcutsStateKey => <ShortcutList
        onRequestClose={onRequestClose} shortcutsStateKey={shortcutsStateKey} />)
    }
  </div>
}
