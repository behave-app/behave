import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ACTIONS } from './VideoPlayer'
import { RootState } from './store'
import { Key, isKey } from "../lib/key.js"


type VideoAction = keyof typeof ACTIONS

export type VideoShortcut = [Key | null, VideoAction]
export type VideoShortcuts = VideoShortcut[]

export function isVideoShortcuts(
  data: unknown
): data is VideoShortcuts {
  if (!isSubjectShortcuts(data)) {
    return false
  }
  return data.every(([_key, action]) => action in ACTIONS)
}

const defaultVideoShortcuts: VideoShortcuts = [
  [{code: "Space"}, "play_pause"],
  [{code: "ArrowLeft"}, "previous_frame"],
  [{code: "ArrowRight"}, "next_frame"],
] as const

type Subject = string
export type SubjectShortcut = [Key | null, Subject]
export type SubjectShortcuts = SubjectShortcut[]

export type SubjectShortcutGroups = {
  readonly selectedIndex: number,
  readonly groups: Array<{
    readonly name: string,
    readonly shortcuts: SubjectShortcuts
  }>
}

export function isSubjectShortcuts(
  data: unknown
): data is SubjectShortcuts {
    if (!Array.isArray(data)) {
      return false
    }
    for (const shortcut of data) {
      if (!Array.isArray(shortcut) || shortcut.length !== 2) {
        return false
      }
      const [key, action] = shortcut
      if (typeof action !== "string") {
        return false
      }
    if (!isKey(key)) {
      return false
    }
  }
  return true
}

export function isSubjectShortcutGroupsGroups(
  data: unknown
): data is SubjectShortcutGroups["groups"] {
  if (!Array.isArray(data)) {
    return false
  }
  for (const group of data) {
    const keys = [...Object.keys(group)].sort()
    if (keys.length !== 2 || keys[0] !== "name" || keys[1] !== "shortcuts"){
      return false
    }
    if (typeof group.name !== "string") {
      return false;
    }
    if (!isSubjectShortcuts(group.shortcuts)) {
      return false
    }
  }
  return true
}


const exampleSubjectShortcuts: SubjectShortcutGroups = {
  selectedIndex: 0,
  groups: [{
    name: "example",
    shortcuts: [
      [{code: "KeyA"}, "Subject A"],
      [{code: "KeyB"}, "Subject B"],
    ]
  }]
} as const

type Behaviour = string
export type BehaviourShortcut = [Key | null, Behaviour]
export type BehaviourShortcuts = BehaviourShortcut[]

export function isBehaviourShortcutGroupsGroups(
  data: unknown
): data is BehaviourShortcutGroups["groups"] {
  // for now, this is the same
  return isSubjectShortcutGroupsGroups(data)
}

export type BehaviourShortcutGroups = {
  readonly selectedIndex: number,
  readonly groups: Array<{
    readonly name: string,
    readonly shortcuts: BehaviourShortcuts
  }>
}

const exampleBehaviourShortcuts: BehaviourShortcutGroups = {
  selectedIndex: 0,
  groups: [{
    name: "example",
    shortcuts: [
      [{code: "KeyC", modifiers: ["shiftKey"]}, "Climbing"],
      [{code: "KeyD", modifiers: ["shiftKey"]}, "Diving"],
    ]
  }]
} as const

const LOCAL_STORAGE_SETTINGS_KEY = "Behave_Settings_v1"

export const settingsToLocalStorage = (settings: SettingsState) => {
  const settingsJSON = JSON.stringify(settings)
  window.localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, settingsJSON)
  console.debug("Settings saved to localStorage")
}

const getSettingsFromLocalStorageOrDefault = (): SettingsState => {
  const settingsJSON = window.localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY)
  if (settingsJSON !== null) {
    try {
    console.debug("Settings retrieved from localStorage")
      return JSON.parse(settingsJSON) as SettingsState
    } catch (e) {
      console.warn("Problem unserializing settings, using default settings")
    }
  }
  return {
    videoShortcuts: defaultVideoShortcuts,
    subjectShortcutsGroups: exampleSubjectShortcuts,
    behaviourShortcutsGroups: exampleBehaviourShortcuts,
  }
}

export type SettingsState = {
  videoShortcuts: VideoShortcuts
  subjectShortcutsGroups: BehaviourShortcutGroups
  behaviourShortcutsGroups: BehaviourShortcutGroups
}

export const settingsSlice = createSlice({
  name: "settings",
  initialState: getSettingsFromLocalStorageOrDefault(),
  reducers: {
    settingsUpdated: (_state, action: PayloadAction<SettingsState>) => {
      return action.payload
    }
  }
})


export default settingsSlice.reducer

export const {
  settingsUpdated,
} = settingsSlice.actions

export const selectSettings = (state: RootState) => state.settings

