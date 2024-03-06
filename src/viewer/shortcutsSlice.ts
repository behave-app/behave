import type { ATConfig, RootState} from './store'
import { PayloadAction, createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { Key, areEqualKeys, keyChecker, keyToString } from "../lib/key"
import { ArrayChecker, Checker, LiteralChecker, NumberChecker, ObjectChecker, RecordChecker, StringChecker, getCheckerFromObject } from '../lib/typeCheck'
import type { ValidControlName } from './controls'
import { ObjectEntries, ObjectKeys, assert } from '../lib/util'


export type Shortcuts<T extends string = string> = Record<T, Key[]>

export type ShortcutPreset<T extends string = string> = {
  name: string
  shortcuts: Shortcuts<T>
}

export const shortcutsPresetChecker: Checker<ShortcutPreset<string>> = getCheckerFromObject({
  name: "",
  shortcuts: new RecordChecker({
    keyChecker: new StringChecker(),
    valueChecker: new ArrayChecker(keyChecker),
  })
})

export type ShortcutPresets<T extends string = string> = {
  presets: ShortcutPreset<T>[]
  selectedIndex: number
}

export const shortcutsPresetsChecker: Checker<ShortcutPresets<string>> = new ObjectChecker({
  required: {
    selectedIndex: new NumberChecker({isInt: true, min: 0}),
    presets: new ArrayChecker(shortcutsPresetChecker)
  }},
  {valid: presets => presets.presets[presets.selectedIndex] !== undefined},
)

export type ShortcutsState = {
  generalShortcuts: ShortcutPresets<string>
  subjectShortcuts: ShortcutPresets<string>
  behaviourShortcuts: ShortcutPresets<string>
}

export type GeneneralShortcuts = Shortcuts<ValidControlName>
export type GeneneralShortcutPreset = ShortcutPreset<ValidControlName>
export type GeneneralShortcutPresets = ShortcutPresets<ValidControlName>

export const shortcutsStateChecker: Checker<ShortcutsState> = new ObjectChecker({
  required: {
    generalShortcuts: shortcutsPresetsChecker,
    subjectShortcuts: shortcutsPresetsChecker,
    behaviourShortcuts: shortcutsPresetsChecker,
  }},
  {valid: undefined},
)

const defaultInitialState: ShortcutsState = {
  generalShortcuts: {
    selectedIndex: 0,
    presets: [
      {
        name: "default",
        shortcuts: {
          previous_frame_with_detection: [{code: "KeyQ"}],
          hide_detection_boxes: [{code: "KeyW"}],
          next_frame_with_detection: [{code: "KeyE"}],
          previous_frame: [{code: "KeyA"}],
          play_pause: [{code: "KeyS"}, {code: "Space"}],
          next_frame: [{code: "KeyD"}],
          speed_down: [{code: "KeyZ"}],
          speed_up: [{code: "KeyC"}],
          edit_comment_for_current_line: [{modifiers: ["shiftKey"], code: "Digit1"}],
          key_shortcut_help_toggle: [{modifiers: ["shiftKey"], code: "Slash"}],
        },
      },
    ]
  },
  subjectShortcuts: {
    selectedIndex: 0,
    presets: [
      {
        name: "example subjects",
        shortcuts: {
          Andrea: [{modifiers: ["shiftKey"], code: "KeyA"}],
          Beatrice: [{modifiers: ["shiftKey"], code: "KeyB"}],
        },
      },
    ]
  },
  behaviourShortcuts: {
    selectedIndex: 0,
    presets: [
      {
        name: "example behaviours",
        shortcuts: {
          Climbing: [{modifiers: ["shiftKey"], code: "KeyC"}],
          Diving: [{modifiers: ["shiftKey"], code: "KeyD"}],
        },
      },
    ]
  }
}

const LOCAL_STORAGE_SHORTCUTS_KEY = "Behave_Shortcuts"
const LOCAL_STORAGE_SHORTCUTS_VERSION = 1 as const
export const shortcutsToLocalStorage = (shortcuts: ShortcutsState) => {
  const settingsJSON = JSON.stringify(
    {version: LOCAL_STORAGE_SHORTCUTS_VERSION, shortcuts}
  )
  window.localStorage.setItem(LOCAL_STORAGE_SHORTCUTS_KEY, settingsJSON)
  console.debug("Shortcuts saved to localStorage")
}

const getShortcutsFromLocalStorageOrDefault = (): ShortcutsState => {
  const logDefault = (...args: unknown[]) => {
    console.log("getShortcutsFromLocalStorage default restored: ", ...args)
  }
  const shortcutsJSON = window.localStorage.getItem(LOCAL_STORAGE_SHORTCUTS_KEY)
  if (shortcutsJSON === null) {
    logDefault("JSON file not found in localStorage")
    return defaultInitialState
  }
  let savedShortcuts: unknown
  try {
    savedShortcuts = JSON.parse(shortcutsJSON)
  } catch (e) {
    logDefault("JSON parse failed")
    return defaultInitialState
  }
  const savedShortcutsStateChecker = getCheckerFromObject({
    version: new LiteralChecker(LOCAL_STORAGE_SHORTCUTS_VERSION),
    shortcuts: shortcutsStateChecker,
  })
  if (!savedShortcutsStateChecker.isInstance(savedShortcuts)) {
    logDefault("Checker failed")
    return defaultInitialState
  }
  return savedShortcuts.shortcuts
}


export const shortcutsSlice = createSlice({
  name: "shortcuts",
  initialState: getShortcutsFromLocalStorageOrDefault(),
  reducers: {
    shortcutKeyAddedOrReplaced: (state, {payload}: PayloadAction<{stateKey: keyof ShortcutsState, action: string, newKey: Key, oldKey: Key | undefined}>) => {
      const {stateKey, action, newKey, oldKey} = payload
      const activePreset = getActivePreset(state[stateKey])
      if (!(action in activePreset.shortcuts)) {
        activePreset.shortcuts[action] = []
      }
      const keys = activePreset.shortcuts[action]
      if (oldKey) {
        const index = keys.findIndex(key => areEqualKeys(key, oldKey));
        if (index !== -1) {
          keys[index] = newKey
        } else {
          console.error("Cannot find oldKey", payload)
        }
      } else {
        keys.push(newKey)
      }
      const duplicateIndices = keys.flatMap((key, index) => areEqualKeys(key, newKey) ? [index] : []).slice(1)
      duplicateIndices.reverse().forEach(index => keys.splice(index, 1))
    },
    shortcutActionAddedOrReplaced: (state, {payload}: PayloadAction<{stateKey: keyof ShortcutsState, oldAction: string | undefined, newAction: string}>) => {
      const {stateKey, newAction, oldAction} = payload
      const activePreset = getActivePreset(state[stateKey])
      const newShortcuts = Object.fromEntries(
        ObjectEntries(activePreset.shortcuts).map(([action, keys]) => (
          [action === oldAction ? newAction : action, keys])))
      if (!(newAction in newShortcuts)) {
        newShortcuts[newAction] = []
      }
      activePreset.shortcuts = newShortcuts
    },
    shortcutKeyRemoved: (state, {payload}: PayloadAction<{key: Key, stateKey?: keyof ShortcutsState, action?: string}>) => {
      const stateKeys = payload.stateKey ? [payload.stateKey] : ObjectKeys(state)
      stateKeys.forEach((stateKey) => {
        const activePreset = getActivePreset(state[stateKey])
        const actions =
          (payload.action !== undefined) ? [payload.action] : ObjectKeys(activePreset.shortcuts)
        actions.forEach((action) => {
          const keys = activePreset.shortcuts[action]
          const index = keys.findIndex(key => areEqualKeys(key, payload.key))
          if (index !== -1) {
            keys.splice(index, 1)
          }
        })
      })
    },
    shortcutActionRemoved: (state, {payload}: PayloadAction<{shortcutsStateKey: "subjectShortcuts" | "behaviourShortcuts", action: string}>) => {
      const activePreset = getActivePreset(state[payload.shortcutsStateKey])
      delete activePreset.shortcuts[payload.action]
    },
    shortcutSwitchActiveIndex: (state, {payload: {stateKey, newActiveIndex}}: PayloadAction<{stateKey: keyof ShortcutsState, newActiveIndex: number}>) => {
      assert(state[stateKey].presets[newActiveIndex] !== undefined)
      state[stateKey].selectedIndex = newActiveIndex
    },

    shortcutPresetRenamed: (state, {payload}: PayloadAction<{
      stateKey: keyof ShortcutsState,
      index: number,
      newName: string,
    }>) => {
      const {stateKey, index, newName} = payload
      const matchIndex = state[stateKey].presets.findIndex(
        preset => preset.name.trim().toLocaleLowerCase() == newName.toLocaleLowerCase().trim())
      assert(matchIndex === -1 || matchIndex === index, 
        "No two presets can have the same case-insensitive-name-mod-trim")
      assert(newName.trim() !== "", "Empty names not allowed")
      const preset = state[stateKey].presets.at(index)
      assert(preset, "Invalid index: " + index.toString())
      preset.name = newName
      console.log({preset}, preset.name)
    },
    shortcutPresetDeleted: (state, {payload}: PayloadAction<{
      stateKey: keyof ShortcutsState,
      index: number,
    }>) => {
      const {stateKey, index } = payload
      assert(index !== state[stateKey].selectedIndex,
        "Cannot delete active preset")
      assert(state[stateKey].presets.at(index),
      "Invalid index: " + index.toString())
      state[stateKey].presets.splice(index, 1)
      if (state[stateKey].selectedIndex > index) {
        state[stateKey].selectedIndex--;
      }
    },
    shortcutPresetAdded: (state, {payload}: PayloadAction<{
      stateKey: keyof ShortcutsState,
      name?: string
      shortcuts?: Shortcuts
    }>) => {
      const {stateKey, name, shortcuts} = payload
      for (let i=0;; i++) {
        const suggestedName = (name ?? "Untitled") + (i ? ` (${i})` : "")
        if (!state[stateKey].presets.some(preset => preset.name === suggestedName)) {
          state[stateKey].presets.push({
            name: suggestedName,
            shortcuts: shortcuts ?? {}
          })
          break
        }
      }
    }
  }
})

export const {
  shortcutKeyRemoved,
  shortcutActionRemoved,
  shortcutPresetAdded,
  shortcutPresetDeleted,
  shortcutPresetRenamed,
  shortcutSwitchActiveIndex,
  shortcutKeyAddedOrReplaced,
} = shortcutsSlice.actions

const {
  shortcutActionAddedOrReplaced,
} = shortcutsSlice.actions

export type ActionAlreadyInUseException = {
  error: "ActionAlreadyInUseException"
  callParams: {
    stateKey: "subjectShortcuts" | "behaviourShortcuts"
    newAction: string
    oldAction?: string
  }
}

function actionAlreadyInUseException(
  exception: Omit<ActionAlreadyInUseException, "error">
): ActionAlreadyInUseException {
  return {
    error: "ActionAlreadyInUseException",
    ...exception
  }
}

export const createOrUpdateAction = createAsyncThunk<
boolean, ActionAlreadyInUseException["callParams"], ATConfig<ActionAlreadyInUseException>
>(
  "settings/shortcuts/createOrUpdateAction",
  async (callParams , {getState, dispatch, rejectWithValue}) =>  {
    const {stateKey, newAction, oldAction} = callParams
    if (oldAction !== null && oldAction === newAction) {
      return false
    }
    assert(stateKey in {subjectShortcuts: 1, behaviourShortcuts: 1},
      "Can only change actions for subject shortcuts and behaviour shortcuts")
    const shortcutPresets = getState().settings.shortcuts[stateKey]
    const activePreset = getActivePreset(shortcutPresets)
    const usedActions = new Set(ObjectKeys(activePreset.shortcuts)
      .filter(s => s !== oldAction).map(s => s.trim().toLocaleLowerCase()))
    if (usedActions.has(newAction.trim().toLocaleLowerCase())) {
      throw rejectWithValue(actionAlreadyInUseException({callParams}))
    }
    dispatch(shortcutActionAddedOrReplaced({stateKey, oldAction, newAction}))
    return true
  }
)

export type ShortcutPresetExportFailedException = {
  error: "ShortcutPresetExportFailedException"
  callParams: {stateKey: keyof ShortcutsState, index: number},
}

function shortcutPresetExportFailedException(
  exception: Omit<ShortcutPresetExportFailedException, "error">
): ShortcutPresetExportFailedException {
  return {
    error: "ShortcutPresetExportFailedException",
    ...exception
  }
}

export function nameFromStateKey(key: keyof ShortcutsState): string {
  return key === "generalShortcuts" ? "General"
  : key === "subjectShortcuts" ? "Subject" : "Behaviour"
}

function getExportSuffix(key: keyof ShortcutsState): `.${string}` {
  return `.${nameFromStateKey(key).toLocaleLowerCase()}-preset-export.json`
}

export const exportPreset = createAsyncThunk<
  void, ShortcutPresetExportFailedException["callParams"],
ATConfig<ShortcutPresetExportFailedException>>(
  "settings/shortcuts/exportPreset",
  async (callParams, {getState, rejectWithValue}) => {
    const {stateKey, index} = callParams
    const preset = getState().settings.shortcuts[stateKey]?.presets[index]
    assert(preset)
    let file: FileSystemFileHandle
    try {
      file = await window.showSaveFilePicker({
        id: "presets",
        startIn: "downloads",
        suggestedName: `${preset.name}${getExportSuffix(stateKey)}`,
        types: [{
          description: "JSON file",
          accept: {"application/json": [".json"]}
        }]
      })
    } catch (e) {
      if (e instanceof DOMException) {
        throw rejectWithValue(shortcutPresetExportFailedException({callParams}))
      }
      throw e
    }
    const outputstream = await file.createWritable()
    await outputstream.write(JSON.stringify({
      type: "preset",
      section: nameFromStateKey(stateKey).toLocaleLowerCase(),
      version: 1,
      preset: preset
    }, undefined, 4))
    await outputstream.close()
  }
)
  
export type ShortcutPresetImportFailedException = {
  error: "ShortcutPresetImportFailedException"
  callParams: {stateKey: keyof ShortcutsState},
  reason: "no file" | "corrupt" | "wrong section",
}

function shortcutPresetImportFailedException(
  exception: Omit<ShortcutPresetImportFailedException, "error">
): ShortcutPresetImportFailedException {
  return {
    error: "ShortcutPresetImportFailedException",
    ...exception
  }
}

export const importPreset = createAsyncThunk<
void, ShortcutPresetImportFailedException["callParams"], ATConfig<ShortcutPresetImportFailedException>>(
  "settings/shortcuts/ImportPreset",
  async (callParams, {getState, dispatch, rejectWithValue}) => {
    const {stateKey} = callParams
    const presets = getState().settings.shortcuts[stateKey]?.presets
    assert(presets)
    let file: FileSystemFileHandle
    try {
      const files = await window.showOpenFilePicker({
        id: "presets",
        startIn: "downloads",
        types: [{
          description: "JSON file",
          accept: {"application/json": [".json"]}
        }]
      })
      assert(files.length === 1)
      file = files[0]
    } catch (e) {
      if (e instanceof DOMException) {
        throw rejectWithValue(shortcutPresetImportFailedException(
          {callParams, reason: "no file"}))
      } else {
        throw e
      }
    }
    const text = await (await file.getFile()).text()
    const data = (() => {
      try {
        return JSON.parse(text)
      } catch {
        throw rejectWithValue(shortcutPresetImportFailedException(
          {callParams, reason: "corrupt"}))
      }
    })()

    const checker = getCheckerFromObject({
      type: new LiteralChecker("preset"),
      section: "",
      version: new LiteralChecker(1),
      preset: shortcutsPresetChecker,
    })

    if (!checker.isInstance(data)) {
      throw rejectWithValue(shortcutPresetImportFailedException(
        {callParams, reason: "corrupt"}))
    }
    if (data.section !== nameFromStateKey(stateKey).toLocaleLowerCase()) {
      throw rejectWithValue(shortcutPresetImportFailedException(
        {callParams, reason: "wrong section"}))
    }
    dispatch(shortcutPresetAdded({stateKey, ...data.preset}))
  }
)


const getActivePreset = <T extends string>(presets: ShortcutPresets<T>) =>
  presets.presets[presets.selectedIndex] ?? presets.presets[0] ?? {name: "error", shortcuts: []}

export const selectGeneralShortcutPresets = (state: RootState) => state.settings.shortcuts.generalShortcuts as GeneneralShortcutPresets
export const selectActiveGeneralShortcutPreset = (state: RootState) => getActivePreset(selectGeneralShortcutPresets(state))

export const selectSubjectShortcutPresets = (state: RootState) => state.settings.shortcuts.subjectShortcuts as GeneneralShortcutPresets
export const selectActiveSubjectShortcutPreset = (state: RootState) => getActivePreset(selectSubjectShortcutPresets(state))
export const selectActiveSubjectShortcutActions = createSelector(
  [selectActiveSubjectShortcutPreset], preset => ObjectKeys(preset.shortcuts))

export const selectBehaviourShortcutPresets = (state: RootState) => state.settings.shortcuts.behaviourShortcuts as GeneneralShortcutPresets
export const selectActiveBehaviourShortcutPreset = (state: RootState) => getActivePreset(selectBehaviourShortcutPresets(state))
export const selectActiveBehaviourShortcutActions = createSelector(
  [selectActiveBehaviourShortcutPreset], preset => ObjectKeys(preset.shortcuts))

export const selectActionByKeyString = createSelector(
  [selectActiveGeneralShortcutPreset, selectActiveSubjectShortcutPreset, selectActiveBehaviourShortcutPreset], (generalPreset, subjectPreset, behaviourPreset) => {
  const presets: Record<keyof ShortcutsState, ShortcutPreset<string>> = {
      "generalShortcuts": generalPreset,
      "subjectShortcuts": subjectPreset,
      "behaviourShortcuts": behaviourPreset,
    }
    return Object.groupBy(ObjectEntries(presets).flatMap(
      ([shortcutsStateKey, preset]) => ObjectEntries(preset.shortcuts).flatMap(
        ([action, keys]) => keys.map(key => ({key, action, shortcutsStateKey})))),
        entry => keyToString(entry.key))
  }
)

