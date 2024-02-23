import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { useEffect, useState, useMemo } from "preact/hooks"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, keyToStrings } from "../lib/key"
import { CONTROLS, ValidControlName } from "./controls"
import { appErrorSet, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import * as css from "./keyshortcuts.module.css"
import { ObjectGet, ObjectKeys, joinedStringFromDict } from "../lib/util"
import { Icon, ValidIconName } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { ActionAlreadyInUseException, ShortcutPreset, ShortcutPresets, ShortcutsState, createOrUpdateAction, createOrUpdateShortcutKey, exportPreset, importPreset, nameFromStateKey, selectActiveBehaviourShortcutPreset, selectActiveGeneralShortcutPreset, selectActiveSubjectShortcutPreset, selectBehaviourShortcutPresets, selectGeneralShortcutPresets, selectSubjectShortcutPresets, shortcutActionRemoved, shortcutKeyRemoved, shortcutPresetAdded, shortcutPresetDeleted, shortcutPresetRenamed, switchActivePreset } from "./shortcutsSlice"
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
  const [editKeyInfo, setEditKeyInfo] = useState<null | {
    index: number,
    key: {modifiers?: Key["modifiers"], code?: Key["code"]},
  }>(null)
  const [editTitleInfo, setEditTitleInfo] = useState<null | {
    title: string} >(null)

  const shortcutsPreset = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutPreset
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutPreset
    : selectActiveBehaviourShortcutPreset) as ShortcutPreset<T extends "generalShortcuts" ? ValidControlName : string>
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

  const usedActions = useMemo(() => new Set(ObjectKeys(shortcutsPreset.shortcuts)
    .filter(s => s !== action).map(s => s.trim().toLocaleLowerCase())),
    [shortcutsPreset]
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

  return <Dialog className={css.edit_dialog} blur onRequestClose={onRequestClose}>
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
  const shortcutsPreset = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutPreset
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutPreset
    : selectActiveBehaviourShortcutPreset) as ShortcutPreset<string>
  const actionKeys = shortcutsStateKey === "generalShortcuts" ? ObjectKeys(CONTROLS) : ObjectKeys(shortcutsPreset.shortcuts)
  const action = actionKeys.at(actionIndex) ?? null
  const keys = action === null ? [] : (shortcutsPreset.shortcuts[action] ?? [])
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

export const getTitleFromShortcutsStateKeyAndAction = (
  shortcutsStateKey: keyof ShortcutsState, action: string): string => {
  return shortcutsStateKey === "generalShortcuts"
    ? ObjectGet(CONTROLS, action)?.description ?? action : action
}

type QuickShortcutListProps = {
  onRequestClose: () => void
  shortcutsStateKey: keyof ShortcutsState
  preset: ShortcutPreset
}

const QuickShortcutList: FunctionComponent<QuickShortcutListProps> = (
  {shortcutsStateKey, onRequestClose, preset}) => {
  const actionList = shortcutsStateKey === "generalShortcuts" ? 
    ObjectKeys(CONTROLS) : ObjectKeys(preset.shortcuts)

  return <Dialog blur onRequestClose={onRequestClose}
  className={css.quick_shortcut_list}>
    <h2 tabIndex={-1}>{nameFromStateKey(shortcutsStateKey)} <Icon
    iconName="arrow_right" /> {preset.name}</h2>
    <dl>
      {actionList.map(action => <>
        <dt>{getTitleFromShortcutsStateKeyAndAction(shortcutsStateKey, action)}</dt>
        <dd>{ObjectGet(preset.shortcuts, action, []).map(keys => 
          <div>{keyToStrings(keys).map(key => <kbd>{key}</kbd>)}</div>
        )}</dd>
      </>)}
    </dl>
    <div className={css.button_row}>
      <button onClick={onRequestClose}>Close</button>
    </div>
  </Dialog>
}

type PresetEditorProps = {
  shortcutsStateKey: keyof ShortcutsState
  onRequestClose: () => void
}

const PresetEditor: FunctionComponent<PresetEditorProps> = (
  {shortcutsStateKey, onRequestClose}
) => {
  const shortcutPresets: ShortcutPresets<string> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectGeneralShortcutPresets(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectSubjectShortcutPresets(state)
        : selectBehaviourShortcutPresets(state))
  const dispatch = useAppDispatch()
  const [showInfoPreset, setShowInfoPreset] = useState<null | ShortcutPreset>(null)
  const [editNameInfo, setEditNameInfo] = useState<null | {index: number, name: string}>(null)
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<undefined | number>(undefined)


  const normalizeName = (name: string) => name.trim().toLocaleLowerCase()

  const trySaveNewName = () => {
    if (!editNameInfo || nameEditError) {
      return
    }
    dispatch(shortcutPresetRenamed({
    stateKey: shortcutsStateKey,
    index: editNameInfo.index,
    newName: editNameInfo.name}))
    setEditNameInfo(null)
  }

  const nameEditError: boolean = !!editNameInfo && (
  normalizeName(editNameInfo.name) === ""
  || !(shortcutPresets.presets.findIndex(
  preset => normalizeName(preset.name) === normalizeName(editNameInfo.name)) in {
  [-1]: true, [editNameInfo.index]: true}))

  function trySwitchIndex(newIndex: number) {
    if (editNameInfo) {
      return;
    }
    if (newIndex === shortcutPresets.selectedIndex) {
      return
    }
    void(dispatch(switchActivePreset({
      newIndices: [{stateKey: shortcutsStateKey, newActiveIndex: newIndex}]})))
  }

  return <Dialog onRequestClose={onRequestClose} className={css.preset_editor}>
    {confirmDeleteIndex !== undefined && <Dialog className={css.confirm_box}
      blur onRequestClose={() => setConfirmDeleteIndex(undefined)}>
      <h2>Delete preset "{shortcutPresets.presets[confirmDeleteIndex].name}"?</h2>
      <div>
        This action cannot be undone; all shortcuts in this preset will be deleted.
      </div>
      <div className={css.button_row}>
        <button onClick={() => {
          dispatch(shortcutPresetDeleted(
            {stateKey: shortcutsStateKey, index: confirmDeleteIndex}));
          setConfirmDeleteIndex(undefined);
        }}>
          Delete</button>
        <button onClick={() => setConfirmDeleteIndex(undefined)}>Cancel</button>
      </div>
    </Dialog>}
    {showInfoPreset && <QuickShortcutList onRequestClose={() => setShowInfoPreset(null)} preset={showInfoPreset} shortcutsStateKey={shortcutsStateKey} />}
    <h2>Change presets for {
      nameFromStateKey(shortcutsStateKey).toLocaleLowerCase()}</h2>
    <ul className={joinedStringFromDict({[css.editing]: !!editNameInfo})}>
      {shortcutPresets.presets.map(
        (preset, index) => <li className={css.show_on_hover_buttons}>
          <span className={css.preset_selected}
            onClick={() => trySwitchIndex(index)}>
            <Icon iconName={index === shortcutPresets.selectedIndex ?
              "radio_button_checked" : "radio_button_unchecked"} />
          </span>
          <span className={joinedStringFromDict({
            [css.preset_name]: true,
            [css.name_edit_error]: nameEditError
          })} onClick={() => trySwitchIndex(index)}>
            {index === editNameInfo?.index ? <input autofocus
              onChange={e => setEditNameInfo({
                index, name: e.currentTarget.value})}
              value={editNameInfo!.name}
              onKeyDown={e => {
                if (e.code === "Escape") {
                  setEditNameInfo(null)
                  e.preventDefault()
                }
                if (e.code === "Enter") {
                  trySaveNewName()
                }
              }}
            /> : <>{preset.name}</>}
          </span>
          <button title={`Show ${ObjectKeys(preset.shortcuts).length} shortcuts`
            + `in "${preset.name}" preset`} className={css.show_on_hover}
            onClick={() => setShowInfoPreset(preset)}>
            <Icon iconName="info" />
          </button>
          <button title="Edit preset name" className={css.show_on_hover}
            onClick={() => setEditNameInfo({index, name: preset.name})}>
            <Icon iconName="edit" /></button>
          {editNameInfo?.index === index &&
            <button title="Save new name" className={joinedStringFromDict({
              [css.show_on_hover]: true, [css.save_button]: true})}
              disabled={nameEditError}
              onClick={() => trySaveNewName()}>
              <Icon iconName="done" /></button>}
          <button title="Duplicate preset" className={css.show_on_hover}
            onClick={() => dispatch(shortcutPresetAdded({
              stateKey: shortcutsStateKey,
              name: "Copy of " + preset.name.replace(/ \(\d+\)$/, ""),
              shortcuts: preset.shortcuts
            }))}>
            <Icon iconName="content_copy" /></button>
          <button title="Export preset to file" className={css.show_on_hover}
            onClick={() => dispatch(exportPreset(
              {stateKey: shortcutsStateKey, index}))}>
            <Icon iconName="download" /></button>
          <button title="Delete preset" className={css.show_on_hover}
            onClick={() => setConfirmDeleteIndex(index)}>
            <Icon iconName="delete" /></button>
        </li>)}
    </ul> 
    <div className={css.button_row}>
      {editNameInfo ? <><button
        disabled={nameEditError}
        onClick={() => trySaveNewName()}>
        Save new name
      </button>
        <button
          onClick={() => setEditNameInfo(null)}>
          Cancel name edit
        </button>
      </>: <><button
          onClick={() => dispatch(shortcutPresetAdded({stateKey: shortcutsStateKey}))}>
          <Icon iconName="add" />Add new preset
        </button>
          <button
            onClick={() => dispatch(importPreset({stateKey: shortcutsStateKey}))}>
            <Icon iconName="upload" />Import preset from file
          </button>
          <button
            onClick={onRequestClose}>Close</button>
        </>}
    </div>
  </Dialog>
}

type ShortcutListProps = {
  onRequestClose: () => void
  shortcutsStateKey: keyof ShortcutsState
}

const ShortcutList: FunctionComponent<ShortcutListProps> = (
  {onRequestClose, shortcutsStateKey}
) => {
  const [isNewShortcut, setIsNewShortcut] = useState(false)
  const [editPresets, setEditPresets] = useState(false)
  const activePreset: ShortcutPreset<string> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectActiveGeneralShortcutPreset(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectActiveSubjectShortcutPreset(state)
        : selectActiveBehaviourShortcutPreset(state))
  const actionList = [
    ...(shortcutsStateKey === "generalShortcuts" ? 
    ObjectKeys(CONTROLS) : ObjectKeys(activePreset.shortcuts)),
    ...(isNewShortcut ? [null] : []),
  ]

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
    <h2>{nameFromStateKey(shortcutsStateKey)} shortcuts</h2>
    <div className={css.current_preset_select}>
      Active key binding preset for this section: <span
        className={css.active_preset}>{activePreset.name}</span>
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
            nameFromStateKey(shortcutsStateKey).toLocaleLowerCase()}
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
