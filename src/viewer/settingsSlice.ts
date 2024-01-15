import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { CONTROL_INFO_S } from './PlayerInfo.js'
import { RootState } from './store'
import { Key, isKey, keyToString } from "../lib/key.js"
import { getDuplicateIndices } from 'src/lib/util'


type VideoAction = keyof typeof CONTROL_INFO_S

export type VideoShortcut = [Key | null, VideoAction]
export type VideoShortcuts = VideoShortcut[]

export function isVideoShortcuts(
  data: unknown
): data is VideoShortcuts {
  if (!isSubjectShortcuts(data)) {
    return false
  }
  return data.every(([_key, action]) => action in CONTROL_INFO_S)
}

const defaultVideoShortcuts: VideoShortcuts = [
  [{code: "KeyQ"}, "previous_frame_with_detection"],
  [{code: "KeyW"}, "next_frame_with_detection"],
  [{code: "KeyE"}, "next_frame_with_detection"],
  [{code: "KeyA"}, "previous_frame"],
  [{code: "KeyS"}, "play_pause"],
  [{code: "KeyD"}, "next_frame"],
  [{code: "KeyZ"}, "speed_down"],
  [{code: "KeyX"}, "play_pause"],
  [{code: "KeyC"}, "speed_up"],
]

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
}

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
}

const LOCAL_STORAGE_SETTINGS_KEY = "Behave_Settings_v1"

export const settingsToLocalStorage = (settings: SettingsState) => {
  const settingsJSON = JSON.stringify(settings)
  window.localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, settingsJSON)
  console.debug("Settings saved to localStorage")
}

const defaultSettings: SettingsState = {
  confidenceCutoff: 0.5,
  videoShortcuts: defaultVideoShortcuts,
  subjectShortcutsGroups: exampleSubjectShortcuts,
  behaviourShortcutsGroups: exampleBehaviourShortcuts,
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
  return defaultSettings
}

export type SettingsState = {
  confidenceCutoff: number
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
export const selectConfidenceCutoff = (state: RootState) => state.settings.confidenceCutoff

export function noDuplicateKeysInShortcuts(
  shortcuts: ReadonlyArray<VideoShortcut | SubjectShortcut | BehaviourShortcut>
): "ok" | {
  duplicateKeyMappings: number[][]
} {
  const duplicates = getDuplicateIndices(
    // small trick, map null keys to a unique number, so they will never show up
    shortcuts.map(([k], index) => k === null ? index : keyToString(k)))
  if (duplicates.length === 0) {
    return "ok"
  }
  return {duplicateKeyMappings: duplicates}
}

export function noDuplicateOrInvalidGroupNames(
  groups: SubjectShortcutGroups | BehaviourShortcutGroups
): "ok" | {
  duplicateGroupNames?: number[][]
  invalidGroupNames?: number[]
  invalidSelectedIndex?: true
} {
  const result: Exclude<ReturnType<typeof noDuplicateOrInvalidGroupNames>, "ok"> = {}
  if (!groups.groups[groups.selectedIndex]) {
    result.invalidSelectedIndex = true
  }
  const duplicates = getDuplicateIndices(
    groups.groups.map(({name}) => name.trim()))
  if (duplicates.length) {
    result.duplicateGroupNames = duplicates
  }
  const invalidNames = groups.groups.map(({name}, index) =>
    name.trim().length === 0 ? index : null).filter(x => x !== null) as number[]
  if (invalidNames.length) {
    result.invalidGroupNames = invalidNames
  }
  if (Object.keys(result).length) {
    return result
  }
  return "ok"
}

export function noInvalidSettings(settings: SettingsState): "ok" | {
  videoShortcutsProblem?: true
  subjectShortcutsGroupsProblem?: true
  behaviourShortcutsGroupsProblem?: true
  videoControlsAndShortcutControlsOverlap?: Key[]
} {
  const result: Exclude<ReturnType<typeof noInvalidSettings>, "ok"> = {}
  if (noDuplicateKeysInShortcuts(settings.videoShortcuts) !== "ok") {
    result.videoShortcutsProblem = true
  }
  if (noDuplicateOrInvalidGroupNames(settings.subjectShortcutsGroups) !== "ok"
    || settings.subjectShortcutsGroups.groups.some(
      group => noDuplicateKeysInShortcuts(group.shortcuts) !== "ok")) {
    result.subjectShortcutsGroupsProblem = true
  }
  if (noDuplicateOrInvalidGroupNames(settings.behaviourShortcutsGroups) !== "ok"
    || settings.behaviourShortcutsGroups.groups.some(
      group => noDuplicateKeysInShortcuts(group.shortcuts) !== "ok")) {
    result.behaviourShortcutsGroupsProblem = true
  }
  const videoAndActiveSubjectShortcuts = [
    ...settings.videoShortcuts,
    ...(settings.subjectShortcutsGroups.groups[settings.subjectShortcutsGroups.selectedIndex] ?? {shortcuts: []}).shortcuts
  ]
  const valid = noDuplicateKeysInShortcuts(videoAndActiveSubjectShortcuts)
  if (valid !== "ok") {
    const duplicates = valid.duplicateKeyMappings
    const cutoffBetweenVideoAndSubject = settings.videoShortcuts.length
    const interestingDuplicates = duplicates.filter(dups => (
      dups[0] < cutoffBetweenVideoAndSubject
        && dups[dups.length - 1]! >= cutoffBetweenVideoAndSubject))
    if (interestingDuplicates.length) {
      result.videoControlsAndShortcutControlsOverlap = interestingDuplicates.map(
        dups => settings.videoShortcuts[dups[0]][0] as Key)
    }
  }
  if (Object.keys(result).length) {
    return result
  }
  return "ok"
}
