import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { useCallback, useEffect, useRef, useState, useMemo } from "preact/hooks"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, keyToStrings } from "../lib/key"
import { CONTROLS, ValidControlName } from "./controls"
import { selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import * as css from "./keyshortcuts.module.css"
import { ObjectKeys, assert, joinedStringFromDict } from "../lib/util"
import { Icon, ValidIconName } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { ActionAlreadyInUseException, KeyAlreadyInUseException, ShortcutGroup, ShortcutsState, createOrUpdateAction, createOrUpdateShortcutKey, selectActiveBehaviourShortcutGroup, selectActiveGeneralShortcutGroup, selectActiveSubjectShortcutGroup, shortcutKeyRemoved } from "./shortcutsSlice"
import { MODIFIER_KEYS } from "../lib/defined_keys"
import { SerializedError } from "@reduxjs/toolkit"
import type { RootState } from "./store"
import { executeShortcutAction } from "./reducers"

const keyToStringsSpecial = (key: Partial<Key>): string[] => {
  const codeMissing = !("code" in key)
  const newKey = (codeMissing ? {...key, code: "KeyA" as const} : {...key}) as Key
  const strings = keyToStrings(newKey)
  return codeMissing ? strings.slice(0, -1) : strings
}

type ControlShortcutEditPopupProps<T extends keyof ShortcutsState> = {
  shortcutsStateKey: T
  action: (T extends "generalShortcuts" ? ValidControlName : string) | null
  onRequestClose: () => void
  onCancelNewShortcut: () => void
  disabled: boolean
  activated: boolean
  keys: ReadonlyArray<Key>
  title: string
  iconName: ValidIconName
}


function ControlShortcutEditPopup<T extends keyof ShortcutsState>(
  {
    shortcutsStateKey, action, onRequestClose, disabled, activated, keys,
    title, iconName, onCancelNewShortcut

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
  const [editTitleInfo, setEditTitleInfo] = useState<null | {
    title: string, error?: SerializedError | ActionAlreadyInUseException} >(null)

  const shortcutsGroup = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutGroup
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutGroup
    : selectActiveBehaviourShortcutGroup) as ShortcutGroup<T extends "generalShortcuts" ? ValidControlName : string>
  useEffect(() => {
    if (action === null) {
      setEditTitleInfo({title: ""})
    }
  }, [action])

  const editKeyInfoRef = useRef(editKeyInfo)
  
  useEffect(() => {
    editKeyInfoRef.current = editKeyInfo
  }, [editKeyInfo])

  const trySaveNewKey = (key: Key) => {
    if (action === null) {
      return
    }
    const editKeyInfo = editKeyInfoRef.current
    assert(editKeyInfo)
    dispatch(createOrUpdateShortcutKey({
      stateKey: shortcutsStateKey,
      action,
      newKey: key,
      oldKey: keys[editKeyInfo.index]
    })).unwrap().then(() => {
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
  }


  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (editKeyInfo?.state !== "doing") {
      return
    }
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
    if (editKeyInfo?.state !== "doing") {
      return
    }
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


  const keysWithEdit = [...keys] as (Key | "edit")[]
  if (editKeyInfo) {
    keysWithEdit[editKeyInfo.index] = "edit"
  }

  const usedActions = useMemo(() => new Set(ObjectKeys(shortcutsGroup.shortcuts)
    .filter(s => s !== action).map(s => s.trim().toLocaleLowerCase())),
    [shortcutsGroup]
  )
  const editTitleIsAllowed = editTitleInfo === null
  || !usedActions.has(editTitleInfo.title.trim().toLocaleLowerCase())

  const trySaveNewAction = (newAction: string) => {
    dispatch(createOrUpdateAction({
      stateKey: shortcutsStateKey as "subjectShortcuts" | "behaviourShortcuts",
      newAction: newAction,
      oldAction: action === null ? undefined : action})).unwrap().then(() => {
        setEditTitleInfo(null)
        if (action === null) {
          onCancelNewShortcut()
        }
      }).catch((error) => {
        setEditTitleInfo({title: newAction, error})
      })
  }

  const currentError = (editKeyInfo && editKeyInfo.state == "error")
  ? {error: editKeyInfo.error, close: () => setEditKeyInfo(null)}
  : (editTitleInfo && editTitleInfo.error)
      ? {error: editTitleInfo.error, close: () => setEditTitleInfo(
        ti => ti ? {...ti, error: undefined} : ti)} : null

  return <Dialog className={css.edit_dialog} blur onRequestClose={onRequestClose}
    onKeyDown={onKeyDown} onKeyUp={onKeyUp}
  >
    <h2 className={css.show_on_hover_buttons}>
      {iconName && <span className={css.icon}><Icon iconName={iconName} /></span>}
      {shortcutsStateKey === "generalShortcuts"
        ? <span className={css.title}>{title}</span>
        : <>{editTitleInfo === null
          ? <span className={css.title} onClick={() => {
            setEditKeyInfo(null);
            setEditTitleInfo({title})}}>
            {title}
          </span>
          : <input type="text" value={editTitleInfo.title}
            className={joinedStringFromDict({[css.title]: true,
              [css.invalid_title]: !editTitleIsAllowed})}
            onChange={e => setEditTitleInfo({title: e.currentTarget.value})} 
            onKeyDown={e => {
              e.stopPropagation()
              if (e.code === "Enter") {
                trySaveNewAction(editTitleInfo.title)
              }
              if (e.code === "Escape") {
                if (action !== null) {
                  setEditTitleInfo(null)
                }
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          />}
          <button className={css.show_on_hover} onClick={() => {
            if (editTitleInfo === null) {
              setEditKeyInfo(null)
              setEditTitleInfo({title})
            } else {
              trySaveNewAction(editTitleInfo.title)
            }}}>
            <Icon iconName={editTitleInfo === null ? "edit" : "save"} />
          </button>
        </>}
    </h2>
    <h3>Status</h3>
    <div>
      {disabled && "[disabled]"} {activated && "[active]"}
      {!(disabled || activated) && "normal"}
    </div>
    <h3>Shortcut keys</h3>
    <div className={joinedStringFromDict({[css.shortcuts]: true})}>
      {keysWithEdit.length ? <div>
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
              onClick={() => {
                setEditTitleInfo(null);
                setEditKeyInfo(key === "edit" ? null : {
                index, state: "doing", key: {}})}}>
              <Icon iconName="edit" />
            </button>
            <button 
              onClick={() => {
                setEditTitleInfo(null)
                dispatch(shortcutKeyRemoved(key as Key))
              }}>
              <Icon iconName="delete" />
            </button>
          </div>)}
      </div> : "No shortcuts defined"}
          <button disabled={action === null} onClick={() => {
          setEditTitleInfo(null);
          setEditKeyInfo({
            index: keys.length, state: "doing", key: {}})}} >
            <Icon iconName="add" />
          </button>
    </div>
    <div className={css.button_row}>
      {editTitleInfo
        ? <>
          <button onClick={() => trySaveNewAction(editTitleInfo.title)}>
            <Icon iconName="save" /> Save
          </button>
          <button onClick={() => action === null ? onCancelNewShortcut() : setEditTitleInfo(null)}>
            Cancel
          </button>
        </> : <>
          <button onClick={() => alert("TODO")}>
            <Icon iconName="delete" />Delete action
          </button>
          <button disabled={action === null} onClick={onRequestClose}>Close</button>
        </>}
    </div>
    {currentError && <Dialog blur type="error"
      className={css.error_popup}
      onRequestClose={() => setEditKeyInfo(null)}>
      {"error" in currentError.error && currentError.error.error === "KeyAlreadyInUseException" ? <>
        <h2>Key already in use</h2>
        <div>
          This key is already in use as a shortcut {
            currentError.error.stateKey === "generalShortcuts"
              ? <>to <em>{CONTROLS[currentError.error.action as ValidControlName].description}</em>.</>
              : <>for the {currentError.error.stateKey === "subjectShortcuts"
                ? "subject" : "behaviour"} <em>{currentError.error.action}</em>.</>}
        </div>
        <div>
          Every key can only be assigned to a single action.
          Below you have a choice to either cancel the edit,
          or delete the other keybinding and reassign {
            keyToStrings(currentError.error.key).map(
              singleKey => <kbd>{singleKey}</kbd>)} to <em>{title}</em>.
        </div>
        <div className={css.button_row}>
          <button onClick={currentError.close}>Cancel</button>
          <button onClick={((key) => () =>{
            dispatch(shortcutKeyRemoved(key));
            trySaveNewKey(key);
          })(currentError.error.key)}>Reassign</button>
        </div>
      </>
        : "error" in currentError.error && currentError.error.error === "ActionAlreadyInUseException" ? <>
          <h2>Action name already in use</h2>
          <div>
            There is already a {currentError.error.stateKey === "subjectShortcuts" ? "subject" : "behaviour"} shortcut with the name <em>{currentError.error.newAction}</em>
            It's not possible to make two shortcuts with the same content.
          </div>
          <div>
            Note that two names are compared in a case-insensitive way, and spaces at the start or end are ignored.
          </div>
          <div>
            Please change the name to a valid one.
          </div>
          <div className={css.button_row}>
            <button onClick={currentError.close}>close</button>
          </div>
        </> : <>
            <h2>Something went wrong</h2>
            <div>
              You should not see this screen, please report.
              <blockquote>{currentError.error.message}</blockquote>
            </div>
            <div className={css.button_row}>
              <button onClick={currentError.close}>close</button>
            </div>
        </>
      }
    </Dialog>
    }
  </Dialog>
}

type ControlShortcutProps = {
  shortcutsStateKey: keyof ShortcutsState
  actionIndex: number
  onRequestClose: () => void
  onCancelNewShortcut: () => void
}

const ControlShortcut: FunctionComponent<ControlShortcutProps> = ({
  shortcutsStateKey, actionIndex, onCancelNewShortcut, onRequestClose
}) => {
  const shortcutsGroup = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutGroup
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutGroup
    : selectActiveBehaviourShortcutGroup) as ShortcutGroup<string>
  const actionKeys = shortcutsStateKey === "generalShortcuts" ? ObjectKeys(CONTROLS) : ObjectKeys(shortcutsGroup.shortcuts)
  const action = actionKeys.at(actionIndex) ?? null
  const keys = action === null ? [] : (shortcutsGroup.shortcuts[action] ?? [])
  const controlInfo = shortcutsStateKey === "generalShortcuts"
    ? CONTROLS[action as ValidControlName] : null

  const disabled = useSelector(
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.selectIsDisabled
    : shortcutsStateKey === "subjectShortcuts"
    ? (state: RootState) => !selectIsWaitingForSubjectShortcut(state)
    : (state: RootState) => !selectIsWaitingForBehaviourShortcut(state))

  const activated = useSelector(controlInfo?.selectIsActivated ?? (() => false))

// eslint-disable-next-line @typescript-eslint/no-explicit-any  -- can fix by making this function a generic
  const dispatch = useAppDispatch()
  const [editPopup, setEditPopup] = useState(false)

  useEffect(() => {
    if (action === null) {
      setEditPopup(true)
    }
  }, [action])

  const title = controlInfo ? controlInfo.description : action ?? ""
  const iconName: ValidIconName = (
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.iconName
      : shortcutsStateKey === "subjectShortcuts" ? "cruelty_free"
        : "sprint")

  return <div className={joinedStringFromDict({
    [css.item]: true,
    [css.show_on_hover_buttons]: true,
  })}>
    <button disabled={disabled}
      className={joinedStringFromDict({
        [css.activated]: activated,
        [css.button]: true,
      })}
      onClick={() => {
        if (disabled || action === null) {
          return
        }
        onRequestClose()
        void(dispatch(executeShortcutAction({shortcutsStateKey, action})))
      }}
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
      onCancelNewShortcut={onCancelNewShortcut}
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
  const [isNewShortcut, setIsNewShortcut] = useState(false)
  const actions = ObjectKeys(shortcuts) as (string | null)[]
  if (isNewShortcut) {
    actions.push(null)
  }

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
      {actions.map((_, index) => <ControlShortcut
        actionIndex={index}
        shortcutsStateKey={shortcutsStateKey}
        onRequestClose={onRequestClose}
        onCancelNewShortcut={() => setIsNewShortcut(false)}
      />)}
    </div>
    {(shortcutsStateKey === "subjectShortcuts"
      || shortcutsStateKey === "behaviourShortcuts") && 
      <div className={css.button_row}>
        <button onClick={() => setIsNewShortcut(true)}>
          <Icon iconName="add" />Add new {
            shortcutsStateKey === "subjectShortcuts" ? "subject" : "behaviour"}
        </button>
      </div>}
    <hr />
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
    <div className={css.button_row}>
    <button onClick={() => onRequestClose()}>Close</button>
    </div>
  </div>
}
