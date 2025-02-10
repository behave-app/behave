import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { useEffect, useState, useContext } from "preact/hooks"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, keyToStrings, keyToString, keyToElements } from "../lib/key"
import { CONTROLS, ValidControlName } from "./controls"
import { selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import * as generalcss from "../lib/general.module.css"
import * as css from "./keyshortcuts.module.css"
import { ObjectGet, ObjectKeys, joinedStringFromDict } from "../lib/util"
import { Icon, ValidIconName } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { ShortcutPreset, ShortcutPresets, ShortcutsState, shortcutKeyAddedOrReplaced, exportPreset, importPreset, nameFromStateKey, selectActiveBehaviourShortcutPreset, selectActiveGeneralShortcutPreset, selectActiveSubjectShortcutPreset, selectBehaviourShortcutPresets, selectGeneralShortcutPresets, selectSubjectShortcutPresets, shortcutActionRemoved, shortcutKeyRemoved, shortcutPresetAddedAndSelected, shortcutPresetDeleted, shortcutPresetRenamed, shortcutSwitchActiveIndex, selectActionByKeyString, shortcutActionAddedOrReplaced } from "./shortcutsSlice"
import { MODIFIER_KEYS } from "../lib/defined_keys"
import type { RootState } from "./store"
import { executeShortcutAction } from "./reducers"
import { ModularPopupSetter } from "../lib/Popups"

const keyToStringsSpecial = (key: Partial<Key>): string[] => {
  const codeMissing = !("code" in key)
  const newKey = (codeMissing ? {...key, code: "KeyA" as const} : {...key}) as Key
  const strings = keyToStrings(newKey)
  return codeMissing ? strings.slice(0, -1) : strings
}

type ControlShortcutEditPopupProps<T extends keyof ShortcutsState> = {
  shortcutsStateKey: T
  action: (T extends "generalShortcuts" ? ValidControlName : string)
  onRequestClose: () => void
  disabled: boolean
  activated: boolean
  keys: ReadonlyArray<Key>
  title: string
  iconName: ValidIconName
  editName: () => void,
}

function ControlShortcutEditPopup<T extends keyof ShortcutsState>(
  {
    shortcutsStateKey, action, onRequestClose, disabled, activated, keys,
    title, iconName, editName,

  }: ControlShortcutEditPopupProps<T>
) {
  const dispatch = useAppDispatch()
  const [editKeyInfo, setEditKeyInfo] = useState<null | {
    index: number,
    key: {modifiers?: Key["modifiers"], code?: Key["code"]},
  }>(null)
  const actionsByKey = useSelector(selectActionByKeyString)
  const duplicateActions = keys.map(key => keyToString(key)).flatMap(
    keyString => actionsByKey[keyString]!.filter(
      a => !(a.action === action && a.shortcutsStateKey === shortcutsStateKey)))
  const modularPopupSetter = useContext(ModularPopupSetter)

  useEffect(() => {
    if (!editKeyInfo) {
      return
    }

    const saveNewKey = (key: Key) => {
      if (action === null) {
        return
      }
      void(dispatch(shortcutKeyAddedOrReplaced({
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
        saveNewKey(key)
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

  return <Dialog className={css.edit_dialog} blur onRequestClose={onRequestClose}>
    <h2 className={generalcss.show_on_hover_buttons}>
      {iconName && <span className={css.icon}><Icon iconName={iconName} /></span>}
      {shortcutsStateKey === "generalShortcuts"
        ? <span className={css.title}>{title}</span>
        : <>
          <span className={css.title} onClick={() => {
            setEditKeyInfo(null);
            editName()
          }}>
            {title}
          </span>
          <button className={generalcss.show_on_hover} onClick={() => {
            setEditKeyInfo(null)
            editName()
          }}>
            <Icon iconName="edit" />
          </button>
        </>}
    </h2>
    <h3>Status <span title="The status shows whether a button is disabled (cannot be used right now), or active (the button toggles a state that is active right now)"><Icon iconName="info" /></span></h3>
    <div>
      {disabled && "[disabled]"} {activated && "[active]"}
      {!(disabled || activated) && "normal"}
    </div>
    <h3>Shortcut keys</h3>
    <div className={joinedStringFromDict({
      [css.shortcuts]: true,
    })}>
      {duplicateActions.length > 0 && <div className={css.duplicate_keys_explain}>
        <h4>Duplicate key binding warning</h4>
        <div>
          Some of the keys bound to this action, are also bound to other actions.
          As a result, when you press the key, you'll be presented with a popup with
          choices.
          The advice is to bind each key to only one action at a time.
        </div>
        <ul>
          {duplicateActions.map(du => <li>{keyToElements(du.key)} is also bound to {
            nameFromStateKey(du.shortcutsStateKey)} <Icon iconName="arrow_right"
            /> {ObjectGet(CONTROLS,
              du.shortcutsStateKey === "generalShortcuts" && du.action
            )?.description ?? du.action}</li>)}
        </ul>
      </div>}
      {keysWithEdit.length ? <><div className={css.key_list}>
        {keysWithEdit.map(
          (key, index) => <div className={joinedStringFromDict({
            [css.shortcut_row]: true,
            [css.editing_key]: key === "edit",
            [css.shortcut_is_duplicate]: key !== "edit" && actionsByKey[keyToString(key)]!.length > 1,
          })}>
            <div className={css.shortcut_key}>
              {keyToStringsSpecial(
                key === "edit" ? editKeyInfo!.key : key).map(
                  singleKey => <kbd>{singleKey}</kbd>)}
            </div>
            <button onClick={() => {
              setEditKeyInfo(key === "edit" ? null : {
                index, key: {}})}}>
              <Icon iconName="edit" />
            </button>
            <button
              onClick={() => {
                dispatch(shortcutKeyRemoved({
                  key: key as Key,
                  stateKey: shortcutsStateKey,
                  action: action as string
                }))
              }}>
              <Icon iconName="delete" />
            </button>
          </div>)}
      </div>
        <button className={css.add_button_small}
          onClick={() => {setEditKeyInfo({
            index: keys.length, key: {}})}} >
          <Icon iconName="add" />
        </button>
      </>
        : <button 
          onClick={() => {setEditKeyInfo({
            index: keys.length, key: {}})}} >
          <Icon iconName="add" /> Add your first keystroke
        </button>
      }
      <hr />
    </div>
    <div className={generalcss.button_row}>
      {shortcutsStateKey !== "generalShortcuts" &&
        <button onClick={() => {
          modularPopupSetter({
            type: "confirm",
            title: `Delete ${nameFromStateKey(shortcutsStateKey).toLowerCase()}`,
            subtitle: `Are you sure you want to delete "${action}"?`,
            yes: () => {
              onRequestClose()
              dispatch(shortcutActionRemoved({shortcutsStateKey, action: action!}));
              modularPopupSetter(null);
            },
            no: () => {
              modularPopupSetter(null);
            }
          })
        }}>
          <Icon iconName="delete" />
          Delete {nameFromStateKey(shortcutsStateKey).toLowerCase()}
        </button>
      }
      <button disabled={action === null} onClick={onRequestClose}>Close</button>
    </div>
  </Dialog>
}

type ControlShortcutProps = {
  shortcutsStateKey: keyof ShortcutsState
  action: string
  editMode: boolean
  setEditMode: (mode: boolean) => void,
  editName: () => void,
  onRequestClose: () => void
}

const ControlShortcut: FunctionComponent<ControlShortcutProps> = ({
  shortcutsStateKey, action, editMode, setEditMode, editName, onRequestClose
}) => {
  const shortcutsPreset = useSelector(
    shortcutsStateKey === "generalShortcuts" ? selectActiveGeneralShortcutPreset
    : shortcutsStateKey === "subjectShortcuts" ? selectActiveSubjectShortcutPreset
    : selectActiveBehaviourShortcutPreset) as ShortcutPreset<string>
  const keys = action === null ? [] : (shortcutsPreset.shortcuts[action] ?? [])
  const controlInfo = shortcutsStateKey === "generalShortcuts"
    ? CONTROLS[action as ValidControlName] : null
  const actionsByKey = useSelector(selectActionByKeyString)
  const duplicateActions = keys.map(key => keyToString(key)).flatMap(
    keyString => actionsByKey[keyString]!.filter(
      a => !(a.action === action && a.shortcutsStateKey === shortcutsStateKey)))

  const disabled = useSelector(
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.selectIsDisabled
    : shortcutsStateKey === "subjectShortcuts"
    ? (state: RootState) => !selectIsWaitingForSubjectShortcut(state)
    : (state: RootState) => !selectIsWaitingForBehaviourShortcut(state))

  const activated = useSelector(controlInfo?.selectIsActivated ?? (() => false))

  const dispatch = useAppDispatch()

  const title = controlInfo ? controlInfo.description : action ?? ""
  const iconName: ValidIconName = (
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.iconName
      : shortcutsStateKey === "subjectShortcuts" ? "cruelty_free"
        : "sprint")

  return <div className={joinedStringFromDict({
    [css.item]: true,
    [generalcss.show_on_hover_buttons]: true,
  })}>
    <button disabled={disabled}
      className={joinedStringFromDict({
        [css.activated]: activated,
        [css.button]: true,
        [css.has_duplicate]: duplicateActions.length > 0,
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
    <button className={generalcss.show_on_hover} onClick={() => setEditMode(true)}>
      <Icon iconName="edit" />
    </button>
    {editMode && <ControlShortcutEditPopup
      onRequestClose={() => setEditMode(false)}
      shortcutsStateKey={shortcutsStateKey}
      editName={editName}
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


type ShortcutListProps = {
  onRequestClose: () => void
  shortcutsStateKey: keyof ShortcutsState
}

const ShortcutList: FunctionComponent<ShortcutListProps> = (
  {onRequestClose, shortcutsStateKey}
) => {
  const [editAction, setEditAction] = useState<string | null>(null)
  const modularPopupSetter = useContext(ModularPopupSetter)

  const presets: ShortcutPresets<string> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectGeneralShortcutPresets(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectSubjectShortcutPresets(state)
        : selectBehaviourShortcutPresets(state))
  const activePreset = presets.presets[presets.selectedIndex]
  const actionList = shortcutsStateKey === "generalShortcuts"
    ? ObjectKeys(CONTROLS)
    : ObjectKeys(presets.presets[presets.selectedIndex].shortcuts)
  const dispatch = useAppDispatch()

  const sectionTitle = shortcutsStateKey === "generalShortcuts"
  ? "General Shortcuts"
  : ((shortcutsStateKey === "subjectShortcuts" ? "Subject" : "Behaviour")
  + " List and Shortcuts")

  const subjectDisabledLine = <>All subjects are disabled at the moment. Subjects can only be chosen when a video file is loaded.</>
  const behaviourDisabledLine = <>All behaviours are disabled at the moment. Behaviours can only be chosen after a subject is chosen. If you want a line without a subject (and only behaviour), create a subject with an empty string as "name".</>


  const intro = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts" ? null
    : shortcutsStateKey === "subjectShortcuts"
    ? (selectIsWaitingForSubjectShortcut(state) ? null : subjectDisabledLine)
    : (selectIsWaitingForBehaviourShortcut(state) ? null : behaviourDisabledLine)
  )

  const editListNamePopup = (type: "new" | "rename") => {
    modularPopupSetter({
      type: "prompt",
      title: type === "new" ? `Create new ${sectionTitle}` : `Rename list "${activePreset.name}"`,
      subtitle: "Name of the list",
      value: type === "new" ? "" : activePreset.name,
      validator: (name) => {
        const compName = name.trim().toLocaleLowerCase()
        if (compName === "") {
          return false
        }
        const foundIndex = presets.presets.findIndex(
          p => p.name.toLocaleLowerCase() === compName)
        if (foundIndex !== -1 && foundIndex !== presets.selectedIndex) {
          return "There is already a list with this name"
        }
        return true
      },
      ok: (name) => {
        if (type === "new") {
          dispatch(shortcutPresetAddedAndSelected(
            {stateKey: shortcutsStateKey, name: name.trim()}))
        } else {
          dispatch(shortcutPresetRenamed(
            {stateKey: shortcutsStateKey, index: presets.selectedIndex, newName: name.trim()}))
        }
        modularPopupSetter(null)
      },
      cancel: () => modularPopupSetter(null)
    })
  }

  const deletePopup = () => {
    if (presets.presets.length === 1) {
      modularPopupSetter({
        type: "alert",
        title: "Delete not possible",
        subtitle: "You cannot delete the last item from the list. First create a new one before deleting this one",
        ok: () => modularPopupSetter(null)
      })
    } else {
      modularPopupSetter({
        type: "confirm",
        title: "Confirm delete",
        subtitle: `Are you sure you want to delete the ${sectionTitle} "${activePreset.name}"`,
        yes: () => {
          dispatch(shortcutPresetDeleted({stateKey: shortcutsStateKey, index: presets.selectedIndex}))
          modularPopupSetter(null)
        },
        no: () => modularPopupSetter(null)
      })
    }
  }

  const editShortcutNamePopup = (oldName: string | null) => {
    const sectionName = nameFromStateKey(shortcutsStateKey).toLocaleLowerCase()
    modularPopupSetter({
      type: "prompt",
      title: `${oldName === null ? "Create new" : "Rename"} ${sectionName}`,
      subtitle: `Name of the ${sectionName}`,
      value: oldName ?? "",
      validator: (name) => {
        const compName = name.trim()
        if (compName !== oldName && compName in activePreset.shortcuts) {
          return `There is already a ${sectionName} with this name`
        }
        return true
      },
      ok: (name) => {
        const newAction = name.trim()
        dispatch(shortcutActionAddedOrReplaced({
          stateKey: shortcutsStateKey,
          oldAction: oldName ?? undefined,
          newAction
        }))
        setEditAction(newAction)
        modularPopupSetter(null)
      },
      cancel: () => modularPopupSetter(null)

    })

  }

  return <div>
    <h2>{sectionTitle}</h2>
    <div className={css.current_preset_select}>
      Using {sectionTitle}:
      <div>
        <select onChange={e => {
          switch(e.currentTarget.value) {
            case "new":
              editListNamePopup("new")
              e.currentTarget.selectedIndex = presets.selectedIndex
              break;
            case "import":
              void(dispatch(importPreset({stateKey: shortcutsStateKey})))
              e.currentTarget.selectedIndex = presets.selectedIndex
              break;
            default:
              void(dispatch(shortcutSwitchActiveIndex(
                {stateKey: shortcutsStateKey,
                  newActiveIndex: e.currentTarget.selectedIndex})))
          }}}>
          {presets.presets.map((preset, index) => 
            <option selected={index === presets.selectedIndex}>{preset.name}</option>
          )}
          <option disabled>&#x23AF;&#x23AF;&#x23AF;&#x23AF;&#x23AF;&#x23AF;</option>
          <option value="new">Create new...</option>
          <option value="import">Import from file...</option>
        </select>
        <button title="Edit name" 
          onClick={() => editListNamePopup("rename")}>
          <Icon iconName="edit" /></button>
        <button title={`Duplicate "${activePreset.name}"`}
          onClick={() => {
            const name = (() => {
              const baseName = activePreset.name
              for (let i = 1;; i++) {
                const name = `Copy ${i === 1 ? "" : `(${i}) `} of ${baseName}`
                if (presets.presets.every(p => p.name !== name)) {
                  return name;
                }
              }
            })()
            dispatch(shortcutPresetAddedAndSelected({
              stateKey: shortcutsStateKey, name,
              shortcuts: activePreset.shortcuts
            }))}}><Icon iconName="content_copy" /></button>
        <button title="Export to file"
          onClick={() => dispatch(exportPreset(
            {stateKey: shortcutsStateKey, index: presets.selectedIndex}))}>
          <Icon iconName="download" /></button>
        <button title="Delete preset"
          onClick={() => {deletePopup()}}><Icon iconName="delete" /></button>
      </div>
    </div>
    {intro && <div className={css.intro}>{intro}</div>}
    <div className={css.shortcut_list}>
      {actionList.map((action) => <ControlShortcut
        action={action}
        shortcutsStateKey={shortcutsStateKey}
        onRequestClose={onRequestClose}
        editMode={action === editAction}
        setEditMode={(mode: boolean) => setEditAction(mode ? action : null)}
        editName={() => editShortcutNamePopup(action)}
      />)}
    </div>
    {(shortcutsStateKey === "subjectShortcuts"
      || shortcutsStateKey === "behaviourShortcuts") && 
      <div className={generalcss.button_row}>
        <button onClick={() => editShortcutNamePopup(null)}>
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
    <div className={generalcss.button_row}>
      <button onClick={() => onRequestClose()}>Close</button>
    </div>
  </div>
}
