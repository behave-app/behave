import { FunctionComponent } from "preact"
import { useSelector } from "react-redux"
import { useEffect, useState, useMemo } from "preact/hooks"
import { useAppDispatch } from "./store"
import { keyFromEvent, Key, keyToStrings, keyToString, keyToElements } from "../lib/key"
import { CONTROLS, ValidControlName } from "./controls"
import { selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, } from "./appSlice"
import * as generalcss from "../lib/general.module.css"
import * as css from "./keyshortcuts.module.css"
import { ObjectGet, ObjectKeys, joinedStringFromDict } from "../lib/util"
import { Icon, ValidIconName } from "../lib/Icon"
import { Dialog } from "../lib/Dialog"
import { ShortcutPreset, ShortcutPresets, ShortcutsState, createOrUpdateAction, shortcutKeyAddedOrReplaced, exportPreset, importPreset, nameFromStateKey, selectActiveBehaviourShortcutPreset, selectActiveGeneralShortcutPreset, selectActiveSubjectShortcutPreset, selectBehaviourShortcutPresets, selectGeneralShortcutPresets, selectSubjectShortcutPresets, shortcutActionRemoved, shortcutKeyRemoved, shortcutPresetAddedAndSelected, shortcutPresetDeleted, shortcutPresetRenamed, shortcutSwitchActiveIndex, selectActionByKeyString } from "./shortcutsSlice"
import { Alert, Confirm, Prompt } from "../lib/Popups"
import { MODIFIER_KEYS } from "../lib/defined_keys"
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
  const actionsByKey = useSelector(selectActionByKeyString)
  const duplicateActions = keys.map(key => keyToString(key)).flatMap(
    keyString => actionsByKey[keyString]!.filter(
      a => !(a.action === action && a.shortcutsStateKey === shortcutsStateKey)))

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

  const usedActions = useMemo(() => new Set(ObjectKeys(shortcutsPreset.shortcuts)
    .filter(s => s !== action).map(s => s.trim().toLocaleLowerCase())),
    [shortcutsPreset]
  )
  const editTitleIsAllowed = editTitleInfo === null
  || !usedActions.has(editTitleInfo.title.trim().toLocaleLowerCase())

  const trySaveNewAction = (newAction: string) => {
    void(dispatch(createOrUpdateAction({
      stateKey: shortcutsStateKey as "subjectShortcuts" | "behaviourShortcuts",
      newAction: newAction.trim(),
      oldAction: action === null ? undefined : action})).unwrap().then(() => {
        setEditTitleInfo(null)
        if (action === null) {
          onCancelNewShortcut()
        }
      }))
  }

  return <Dialog className={css.edit_dialog} blur onRequestClose={onRequestClose}>
    <h2 className={generalcss.show_on_hover_buttons}>
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
          <button className={generalcss.show_on_hover} onClick={() => {
            if (editTitleInfo === null) {
              setEditKeyInfo(null)
              setEditTitleInfo({title})
            } else {
              trySaveNewAction(editTitleInfo.title)
            }}}>
            <Icon iconName={editTitleInfo ? "check" : "edit"} />
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
            <button disabled={!!editTitleInfo} 
              onClick={() => {
                if (editTitleInfo) return
                setEditKeyInfo(key === "edit" ? null : {
                  index, key: {}})}}>
              <Icon iconName="edit" />
            </button>
            <button disabled={!!editTitleInfo} 
              onClick={() => {
                if (editTitleInfo) return
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
        <button disabled={!!editTitleInfo} className={css.add_button_small}
          onClick={() => {if (editTitleInfo) return; setEditKeyInfo({
            index: keys.length, key: {}})}} >
          <Icon iconName="add" />
        </button>
      </>

        : <button disabled={!!editTitleInfo || action === null}
        onClick={() => {if (editTitleInfo) return; setEditKeyInfo({
          index: keys.length, key: {}})}} >
        <Icon iconName="add" /> Add your first keystroke
      </button>
      }
      <hr />
    </div>
    <div className={generalcss.button_row}>
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
              <Icon iconName="delete" />
              Delete {nameFromStateKey(shortcutsStateKey).toLowerCase()}
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
    <button className={generalcss.show_on_hover} onClick={() => setEditPopup(true)}>
      <Icon iconName="edit" />
    </button>
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


type ShortcutListProps = {
  onRequestClose: () => void
  shortcutsStateKey: keyof ShortcutsState
}

const ShortcutList: FunctionComponent<ShortcutListProps> = (
  {onRequestClose, shortcutsStateKey}
) => {
  const [isNewShortcut, setIsNewShortcut] = useState(false)
  const [popup, setPopup] = useState<"new" | "editName" | "delete" | null>(null)
  const presets: ShortcutPresets<string> = useSelector((state: RootState) =>
    shortcutsStateKey === "generalShortcuts"
      ? selectGeneralShortcutPresets(state)
      : shortcutsStateKey === "subjectShortcuts"
        ? selectSubjectShortcutPresets(state)
        : selectBehaviourShortcutPresets(state))
  const activePreset = presets.presets[presets.selectedIndex]
  const actionList = [
    ...(shortcutsStateKey === "generalShortcuts" ? 
    ObjectKeys(CONTROLS) : ObjectKeys(presets.presets[presets.selectedIndex].shortcuts)),
    ...(isNewShortcut ? [null] : []),
  ]
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

  return <div>
    {popup === null
      ? null
      : popup === "delete"
        ? (presets.presets.length === 1
          ? <Alert
            title="Delete not possible"
            subtitle="You cannot delete the last item from the list. First create a new one before deleting this one"
            ok={() => setPopup(null)}
          />
          : <Confirm
            title="Confirm delete"
            subtitle={`Are you sure you want to delete the ${sectionTitle} "${activePreset.name}"`}
            yes={() => {
              dispatch(shortcutPresetDeleted({stateKey: shortcutsStateKey, index: presets.selectedIndex}))
              setPopup(null)
            }}
            no={() => setPopup(null)}
          />
        ): <Prompt
          title={popup === "new" ? `Create new ${sectionTitle}` : `Rename list "${activePreset.name}"`}
          subtitle="Name of the list"
          value={popup === "new" ? "" : activePreset.name}
          validator={name => {
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
          }}
          ok={(name) => {
            if (popup === "new") {
              dispatch(shortcutPresetAddedAndSelected(
                {stateKey: shortcutsStateKey, name: name.trim()}))
            } else {
              dispatch(shortcutPresetRenamed(
                {stateKey: shortcutsStateKey, index: presets.selectedIndex, newName: name.trim()}))

          }
          setPopup(null)
        }}
        cancel={() => setPopup(null)}
      />
    }
    <h2>{sectionTitle}</h2>
    <div className={css.current_preset_select}>
      Using {sectionTitle}:
      <div>
        <select onChange={e => {
          switch(e.currentTarget.value) {
            case "new":
              setPopup("new")
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
          <option value="import">Import preset file...</option>
        </select>
        <button title="Edit name" 
          onClick={() => setPopup("editName")}>
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
          onClick={() => {setPopup("delete")}}><Icon iconName="delete" /></button>
      </div>
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
      <div className={generalcss.button_row}>
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
    <div className={generalcss.button_row}>
      <button onClick={() => onRequestClose()}>Close</button>
      <button onClick={() => alert("TODO")}>reset</button>
    </div>
  </div>
}
