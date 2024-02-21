import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { useEffect, useRef, useState, useMemo } from "preact/hooks"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, keyToStrings } from "../lib/key"
import { CONTROLS, ValidControlName } from "./controls"
import { appErrorSet, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import * as css from "./keyshortcuts.module.css"
import { ObjectKeys, assert, joinedStringFromDict } from "../lib/util"
import { Icon, ValidIconName } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { ActionAlreadyInUseException, KeyAlreadyInUseException, ShortcutGroup, ShortcutGroups, ShortcutsState, createOrUpdateAction, createOrUpdateShortcutKey, selectActiveBehaviourShortcutActions, selectActiveBehaviourShortcutGroup, selectActiveGeneralShortcutGroup, selectActiveSubjectShortcutActions, selectActiveSubjectShortcutGroup, selectBehaviourShortcutGroups, selectGeneralShortcutGroups, selectSubjectShortcutGroups, shortcutActionRemoved, shortcutKeyRemoved } from "./shortcutsSlice"
import { MODIFIER_KEYS } from "../lib/defined_keys"
import { SerializedError, createSelector } from "@reduxjs/toolkit"
import type { RootState } from "./store"
import { executeShortcutAction } from "./reducers"
import { useCallback } from "react"

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
  const [editKeyInfo, setEditKeyInfo] = useState<null | {
    index: number,
    key: {modifiers?: Key["modifiers"], code?: Key["code"]},
  }>(null)
  const [editTitleInfo, setEditTitleInfo] = useState<null | {
    title: string} >(null)

  const shortcutsGroup = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutGroup
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutGroup
    : selectActiveBehaviourShortcutGroup) as ShortcutGroup<T extends "generalShortcuts" ? ValidControlName : string>
  useEffect(() => {
    if (action === null) {
      setEditTitleInfo({title: ""})
    }
  }, [action])

  useEffect(() => {
    if (!editKeyInfo) {
      return
    }

    const trySaveNewKey = (key: Key) => {
      if (action === null) {
        return
      }
      void(dispatch(createOrUpdateShortcutKey({
        stateKey: shortcutsStateKey,
        action,
        newKey: key,
        oldKey: keys[editKeyInfo.index]
      })))
      setEditKeyInfo(null)
    }

    const updateEditKeyInfo = (e: KeyboardEvent) => {
      setEditKeyInfo(editKeyInfo => {
        if (!editKeyInfo) {
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

    const onKeyDown = (e: KeyboardEvent) => {
      const key = keyFromEvent(e)
      if (e.code === "Escape") {
        setEditKeyInfo(null)
        e.preventDefault()
        return
      }
      if (key) {
        e.preventDefault()
        trySaveNewKey(key)
      } else {
        updateEditKeyInfo(e)
      }
    }

    const onKeyUp = updateEditKeyInfo

    document.documentElement.addEventListener("keydown", onKeyDown)
    document.documentElement.addEventListener("keyup", onKeyUp)
    return () => {
      document.documentElement.removeEventListener("keydown", onKeyDown)
      document.documentElement.removeEventListener("keyup", onKeyUp)
    }
  }, [editKeyInfo, action, shortcutsStateKey])

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
      newAction: newAction.trim(),
      oldAction: action === null ? undefined : action})).unwrap().then(() => {
        setEditTitleInfo(null)
        if (action === null) {
          onCancelNewShortcut()
        }
      }).catch((error: SerializedError | ActionAlreadyInUseException) => {
        dispatch(appErrorSet(error))
      })
  }

  return <Dialog className={css.edit_dialog} blur onRequestClose={onRequestClose}
    suppressShortcuts>
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
            placeholder="<empty>"
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
            <Icon iconName="edit" />
          </button>
        </>}
    </h2>
    <h3>Status</h3>
    <div>
      {disabled && "[disabled]"} {activated && "[active]"}
      {!(disabled || activated) && "normal"}
    </div>
    <h3>Shortcut keys</h3>
    <div className={joinedStringFromDict({
      [css.shortcuts]: true,
    })}>
      {keysWithEdit.length ? <><div className={css.key_list}>
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
                  index, key: {}})}}>
              <Icon iconName="edit" />
            </button>
            <button 
              onClick={() => {
                setEditTitleInfo(null)
                dispatch(shortcutKeyRemoved({key: key as Key}))
              }}>
              <Icon iconName="delete" />
            </button>
          </div>)}
      </div>
        <button className={css.add_button_small}
          onClick={() => {setEditTitleInfo(null); setEditKeyInfo({
            index: keys.length, key: {}})}} >
          <Icon iconName="add" />
        </button>
      </>

        : <button disabled={action === null}
        onClick={() => {setEditTitleInfo(null); setEditKeyInfo({
          index: keys.length, key: {}})}} >
        <Icon iconName="add" /> Add your first keystroke
      </button>
      }
      <hr />
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
          {shortcutsStateKey !== "generalShortcuts" &&
            <button onClick={() => {
              onRequestClose()
              dispatch(shortcutActionRemoved({shortcutsStateKey, action: action!}));
            }}>
              <Icon iconName="delete" />Delete action
            </button>
          }
          <button disabled={action === null} onClick={onRequestClose}>Close</button>
        </>}
    </div>
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
      <div className={css.title}>{title}</div>
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

type PresetEditorProps = {
  shortcutsStateKey: keyof ShortcutsState
  onRequestClose: () => void
}

const PresetEditor: FunctionComponent<PresetEditorProps> = (
  {shortcutsStateKey, onRequestClose}
) => {
  const shortcutGroups: ShortcutGroups<string> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectGeneralShortcutGroups(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectSubjectShortcutGroups(state)
        : selectBehaviourShortcutGroups(state))
  
  return <Dialog onRequestClose={onRequestClose} suppressShortcuts
    className={css.preset_editor}
  >
    <h2>Change presets for
      {nameFromShortcutStateKey(shortcutsStateKey).toLocaleLowerCase()}</h2>
    <ul>
      {shortcutGroups.groups.map(
        (group, index) => <li className={css.show_on_hover_buttons}>
          <Icon iconName={index === shortcutGroups.selectedIndex ?
            "radio_button_checked" : "radio_button_unchecked"} />
          <span className={css.preset_name}>{group.name}</span>
          <button className={css.show_on_hover}><Icon iconName="edit" /></button>
          <button className={css.show_on_hover}>
            <Icon iconName="content_copy" /></button>
          <button className={css.show_on_hover}><Icon iconName="delete" /></button>
        </li>)}
    </ul>
    <button><Icon iconName="add" /></button>
  </Dialog>
}

function nameFromShortcutStateKey(key: keyof ShortcutsState): string {
  return key === "generalShortcuts" ? "General"
  : key === "subjectShortcuts" ? "Subject" : "Behaviour"
}

type ShortcutListProps = {
  onRequestClose: () => void
  shortcutsStateKey: keyof ShortcutsState
}

const selectActiveGeneralShortcutActions = createSelector(
  [_ => null], _ => ObjectKeys(CONTROLS))

const ShortcutList: FunctionComponent<ShortcutListProps> = (
  {onRequestClose, shortcutsStateKey}
) => {
  const [isNewShortcut, setIsNewShortcut] = useState(false)
  const [editPresets, setEditPresets] = useState(false)
  const activeGroup: ShortcutGroup<string> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectActiveGeneralShortcutGroup(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectActiveSubjectShortcutGroup(state)
        : selectActiveBehaviourShortcutGroup(state))
  let actionList: ReadonlyArray<string | null> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectActiveGeneralShortcutActions(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectActiveSubjectShortcutActions(state)
        : selectActiveBehaviourShortcutActions(state))
  if (isNewShortcut) {
    actionList = [...actionList, null]
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
    {editPresets && <PresetEditor shortcutsStateKey={shortcutsStateKey} onRequestClose={() => setEditPresets(false)} />}
    <h2>{nameFromShortcutStateKey(shortcutsStateKey)} shortcuts</h2>
    <div className={css.current_group_select}>
      Active key binding preset for this section: <span
        className={css.active_preset}>{activeGroup.name}</span>
      <button onClick={() => setEditPresets(true)}>edit</button>
    </div>
    {intro && <div className={css.intro}>{intro}</div>}
    <div className={css.shortcut_list}>
      {actionList.map((_, index) => <ControlShortcut
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
            nameFromShortcutStateKey(shortcutsStateKey).toLocaleLowerCase()}
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
