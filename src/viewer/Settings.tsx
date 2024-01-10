import { FunctionComponent } from "preact"
import * as css from "./settings.module.css"
import { useDispatch } from "react-redux"
import { settingsScreenHidden } from "./appSlice.js"
import { useState, useReducer } from "react"
import { Key, InvalidKeyError,
  VideoShortcut, VideoShortcuts,
  SubjectShortcut, SubjectShortcuts,
  BehaviourShortcut, BehaviourShortcuts,
  SettingsState, selectSettings } from "./settingsSlice"
import { useSelector } from "react-redux"
import { SettingsShortcutsEditor } from "./SettingsShortcutsEditor.js"

function removeShortcut(shortcuts: VideoShortcuts, shortcut: VideoShortcut): VideoShortcuts;
function removeShortcut(shortcuts: SubjectShortcuts, shortcut: SubjectShortcut): SubjectShortcuts;
function removeShortcut(shortcuts: BehaviourShortcuts, shortcut: BehaviourShortcut): BehaviourShortcuts;
function removeShortcut(
  shortcuts: VideoShortcuts | SubjectShortcuts | BehaviourShortcuts,
  shortcut: VideoShortcut | SubjectShortcut | BehaviourShortcut
): VideoShortcuts | SubjectShortcuts | BehaviourShortcuts {
  const [keyToRemove, actionToRemove] = shortcut
  const keyToRemoveStr = keyToRemove.toString()
  return shortcuts.filter(([key, action]) => !(
    action === actionToRemove && key.toString() === keyToRemoveStr))
}

type ReducerAction = {
  type: "videoShortcutAdded",
  payload: {shortcut: VideoShortcut}
} | {
  type: "videoShortcutRemoved",
  payload: {shortcut: VideoShortcut}
} | {
  type: "subjectShortcutsGroupAdded",
  payload: {groupName: string}
} | {
  type: "subjectShortcutsGroupRemoved",
  payload: {groupName: string}
} | {
  type: "subjectShortcutInGroupAdded",
  payload: {groupName: string, shortcut: SubjectShortcut}
} | {
  type: "subjectShortcutInGroupRemoved",
  payload: {groupName: string, shortcut: SubjectShortcut}
}

const reducer = (state: SettingsState, action: ReducerAction): SettingsState => {
  switch (action.type) {
    case "videoShortcutAdded": {
      return {
        ...state,
        videoShortcuts: [
          ...state.videoShortcuts,
          action.payload.shortcut
        ]
      }
    }
    case "videoShortcutRemoved": {
      return {
        ...state,
        videoShortcuts: removeShortcut(state.videoShortcuts, action.payload.shortcut) 
      }
    }
    case "subjectShortcutsGroupAdded": {
      const groupName = action.payload.groupName
      if (groupName in state.subjectShortcutsGroups) {
        console.log(`Group with name ${groupName} already exists, not creating`)
        return state
      }
      return {
        ...state,
        subjectShortcutsGroups: {
          ...state.subjectShortcutsGroups,
          [groupName]: []
        }
      }
    }
    case "subjectShortcutsGroupRemoved": {
      const groupName = action.payload.groupName
      if (! (groupName in state.subjectShortcutsGroups)) {
        console.log(`Group with name ${groupName} does not exist, not removing`)
        return state
      }
      return {
        ...state,
        subjectShortcutsGroups: Object.fromEntries(
          Object.entries(state.subjectShortcutsGroups)
            .filter(([key]) => key !== groupName)),
      }
    }
    case "subjectShortcutInGroupAdded": {
      const {groupName, shortcut} = action.payload
      if (! (groupName in state.subjectShortcutsGroups)) {
        console.log(`Group with name ${groupName} does not exist, not adding shortcut`)
        return state
      }
      return {
        ...state,
        subjectShortcutsGroups: {
          ...state.subjectShortcutsGroups,
          [groupName]: [
            ...state.subjectShortcutsGroups[groupName],
            shortcut,
          ]
        }
      }
    }
    case "subjectShortcutInGroupRemoved": {
      const {groupName, shortcut} = action.payload
      if (! (groupName in state.subjectShortcutsGroups)) {
        console.log(`Group with name ${groupName} does not exist, not removing shortcut`)
        return state
      }
      return {
        ...state,
        subjectShortcutsGroups: {
          ...state.subjectShortcutsGroups,
          [groupName]: removeShortcut(
            state.subjectShortcutsGroups[groupName],
            shortcut,
          )
        }
      }
    }
    default:
      const exhaustive: never = action
      throw new Error(`Exhaustive check: ` + (exhaustive as any).type)
  }
}

export const Settings: FunctionComponent = () => {
  const dispatch = useDispatch()
  const [localSettings, localSettingsDispatch] = useReducer(
    reducer, useSelector(selectSettings))

  return <div className={css.background}>
    <div className={css.popup}>
      <h1>Settings</h1>
      <SettingsShortcutsEditor
        type="video"
        shortcuts={localSettings.videoShortcuts}
        updateShortcuts={s => console.log(s)}
      />
      <button onClick={() => dispatch(settingsScreenHidden())}>close</button>
    </div>
  </div>



}
