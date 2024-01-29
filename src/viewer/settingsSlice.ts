import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { ValidControlName, } from './controls'
import type { RootState } from './store'
import { Key, isKey, keyToString } from "../lib/key"
import { assert, getDuplicateIndices } from '../lib/util'



export type VideoShortcut = [Key | null, ValidControlName]
export type VideoShortcuts = VideoShortcut[]

export function isVideoShortcuts(
  data: unknown
): data is VideoShortcuts {
  throw new Error("To implement; at the moment results in cyclic import")
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
  [{modifiers: ["shiftKey"], code: "Slash"}, "key_shortcut_help_toggle"],
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
      [{modifiers: ["shiftKey"], code: "KeyA"}, "Subject A"],
      [{modifiers: ["shiftKey"], code: "KeyB"}, "Subject B"],
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
export const selectActiveVideoShortcuts = (state: RootState) => state.settings.videoShortcuts
export const selectActiveSubjectShortcuts = (state: RootState) => state.settings.subjectShortcutsGroups.groups[state.settings.subjectShortcutsGroups.selectedIndex].shortcuts

export const selectActiveBehaviourShortcuts = (state: RootState) => state.settings.behaviourShortcutsGroups.groups[state.settings.behaviourShortcutsGroups.selectedIndex].shortcuts

export type BehaviourColoumnType = "frameNumber" | "pts" | `dateTime:${string}` | "subject" | "behaviour" | `comments:${string}`
export type BehaveLayout = Array<{width: number | "*", type: BehaviourColoumnType}>

export const selectBehaviourLayout = createSelector([(_state) => 1], (_one) => [
  {width: 2, type: "frameNumber"},
  {width: 5, type: "dateTime:%d-%m-%Y"},
  {width: 5, type: "dateTime:%H:%M:%S"},
  {width: 10, type: "subject"},
  {width: 15, type: "behaviour"},
  {width: "*", type: "comments:comments"},
] as BehaveLayout)

export const selectFramenumberIndexInLayout = createSelector(
  [selectBehaviourLayout], (behaviourLayout) => {
    const index = behaviourLayout.findIndex(bl => bl.type === "frameNumber")
    assert(index !== -1)
    return index
})

export type VideoShortcutItem = {type: "video", key: VideoShortcut[0], action: VideoShortcut[1]}
export const selectVideoShortcutMap = createSelector(
[selectActiveVideoShortcuts],
(videoShortcuts) => {
    return new Map([
      ...videoShortcuts
      .filter(([key]) => key !== null)
      .map(([key, action]) => (
        [keyToString(key!), {type: "video", key, action}] as
        [string, VideoShortcutItem]
      )),
    ])
})

export type SubjectShortcutItem = {type: "subject", key: SubjectShortcut[0], action: SubjectShortcut[1]}
export const selectSubjectShortcutMap = createSelector(
[selectActiveSubjectShortcuts],
(subjectShortcuts) => {
    return new Map([
      ...subjectShortcuts
      .filter(([key]) => key !== null)
      .map(([key, action]) => (
        [keyToString(key!), {type: "subject", key, action}] as
        [string, SubjectShortcutItem]
      )),
    ])
})

export type BehaviourShortcutItem = {type: "behaviour", key: BehaviourShortcut[0], action: BehaviourShortcut[1]}
export const selectBehaviourShortcutMap = createSelector(
[selectActiveBehaviourShortcuts],
(behaviourShortcuts) => {
    return new Map([
      ...behaviourShortcuts
      .filter(([key]) => key !== null)
      .map(([key, action]) => (
        [keyToString(key!), {type: "behaviour", key, action}] as
        [string, BehaviourShortcutItem]
      )),
    ])
})

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
  videoControlsAndBehaviourControlsOverlap?: Key[]
  subjectControlsAndBehaviourControlsOverlap?: Key[]
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
  const checkCombinedOverlap = (
  shortcuts1: VideoShortcuts | SubjectShortcuts | BehaviourShortcuts,
  shortcuts2: VideoShortcuts | SubjectShortcuts | BehaviourShortcuts,
  ) => {
    const combinedShortcuts = [
      ...shortcuts1,
      ...shortcuts2,
    ]
    const valid = noDuplicateKeysInShortcuts(combinedShortcuts)
    if (valid === "ok") {
      return []
    }
    const duplicates = valid.duplicateKeyMappings
    const cutoffBetweenFirstAndSecond = settings.videoShortcuts.length
    const interestingDuplicates = duplicates.filter(dups => (
      dups[0] < cutoffBetweenFirstAndSecond
        && dups[dups.length - 1]! >= cutoffBetweenFirstAndSecond))
    return interestingDuplicates.map(
      dups => settings.videoShortcuts[dups[0]][0] as Key)
  }

  const videoAndSubjectOverlap = checkCombinedOverlap(
    settings.videoShortcuts,
    (settings.subjectShortcutsGroups.groups[settings.subjectShortcutsGroups.selectedIndex] ?? {shortcuts: []}).shortcuts,
  )
  if (videoAndSubjectOverlap.length) {
    result.videoControlsAndShortcutControlsOverlap = videoAndSubjectOverlap
  }
  const subjectAndBehaviourOverlap = checkCombinedOverlap(
    (settings.subjectShortcutsGroups.groups[settings.subjectShortcutsGroups.selectedIndex] ?? {shortcuts: []}).shortcuts,
    (settings.behaviourShortcutsGroups.groups[settings.behaviourShortcutsGroups.selectedIndex] ?? {shortcuts: []}).shortcuts,
  )
  if (subjectAndBehaviourOverlap.length) {
    result.subjectControlsAndBehaviourControlsOverlap = subjectAndBehaviourOverlap
  }
  const videoAndBehaviourOverlap = checkCombinedOverlap(
    settings.videoShortcuts,
    (settings.behaviourShortcutsGroups.groups[settings.behaviourShortcutsGroups.selectedIndex] ?? {shortcuts: []}).shortcuts,
  )
  if (videoAndBehaviourOverlap.length) {
    result.videoControlsAndBehaviourControlsOverlap = videoAndBehaviourOverlap
  }
  if (Object.keys(result).length) {
    return result
  }
  return "ok"
}
