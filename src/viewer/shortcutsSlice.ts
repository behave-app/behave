import type { ATConfig, RootState} from './store'
import { PayloadAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { Key, areEqualKeys, keyChecker } from "../lib/key"
import { ArrayChecker, Checker, LiteralChecker, NumberChecker, ObjectChecker, RecordChecker, StringChecker, getCheckerFromObject } from '../lib/typeCheck'
import type { ValidControlName } from './controls'
import { ObjectEntries, ObjectKeys } from '../lib/util'


export type Shortcuts<T extends string = string> = Record<T, Key[]>

export type ShortcutGroup<T extends string = string> = {
  name: string
  shortcuts: Shortcuts<T>
}

export const shortcutsGroupChecker: Checker<ShortcutGroup<string>> = getCheckerFromObject({
  name: "",
  shortcuts: new RecordChecker({
    keyChecker: new StringChecker(),
    valueChecker: new ArrayChecker(keyChecker),
  })
})

export type ShortcutGroups<T extends string = string> = {
  groups: ShortcutGroup<T>[]
  selectedIndex: number
}

export const shortcutsGroupsChecker: Checker<ShortcutGroups<string>> = new ObjectChecker({
  required: {
    selectedIndex: new NumberChecker({isInt: true, min: 0}),
    groups: new ArrayChecker(shortcutsGroupChecker)
  }},
  {valid: groups => groups.groups[groups.selectedIndex] !== undefined},
)

export type ShortcutsState = {
  generalShortcuts: ShortcutGroups<string>
  subjectShortcuts: ShortcutGroups<string>
  behaviourShortcuts: ShortcutGroups<string>
}

export type GeneneralShortcuts = Shortcuts<ValidControlName>
export type GeneneralShortcutGroup = ShortcutGroup<ValidControlName>
export type GeneneralShortcutGroups = ShortcutGroups<ValidControlName>

export const shortcutsStateChecker: Checker<ShortcutsState> = new ObjectChecker({
  required: {
    generalShortcuts: shortcutsGroupsChecker,
    subjectShortcuts: shortcutsGroupsChecker,
    behaviourShortcuts: shortcutsGroupsChecker,
  }},
  {valid: undefined},
)

const defaultInitialState: ShortcutsState = {
  generalShortcuts: {
    selectedIndex: 0,
    groups: [
      {
        name: "default",
        shortcuts: {
          previous_frame_with_detection: [{code: "KeyQ"}],
          hide_detection_boxes: [{code: "KeyW"}],
          next_frame_with_detection: [{code: "KeyE"}],
          previous_frame: [{code: "KeyA"}],
          play_pause: [{code: "KeyS"}, {code: "KeyX"}],
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
    groups: [
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
    groups: [
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
export const shortcutsToLocalStorage = (shortcutsState: ShortcutsState) => {
  const settingsJSON = JSON.stringify(
    {version: LOCAL_STORAGE_SHORTCUTS_VERSION, shortcutsState}
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
      const activeGroup = getActiveGroup(state[stateKey])
      if (!(action in activeGroup.shortcuts)) {
        activeGroup.shortcuts[action] = []
      }
      const keys = activeGroup.shortcuts[action]
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
    },
    shortcutActionAddedOrReplaced: (state, {payload}: PayloadAction<{stateKey: keyof ShortcutsState, oldAction: string | undefined, newAction: string}>) => {
      const {stateKey, newAction, oldAction} = payload
      const activeGroup = getActiveGroup(state[stateKey])
      const newShortcuts = Object.fromEntries(
      ObjectEntries(activeGroup.shortcuts).map(([action, keys]) => (
        [action === oldAction ? newAction : action, keys])))
      if (!(newAction in newShortcuts)) {
        newShortcuts[newAction] = []
      }
      activeGroup.shortcuts = newShortcuts
    },
    shortcutKeyRemoved: (state, {payload: keyToRemove}: PayloadAction<Key>) => {
      Object.values(state).forEach((shortcutGroups) => {
        const activeGroup = getActiveGroup(shortcutGroups)
        Object.values(activeGroup.shortcuts).forEach((keys) => {
          const index = keys.findIndex(key => areEqualKeys(key, keyToRemove))
          if (index !== -1) {
            keys.splice(index, 1)
          }
        })
      })
    }
  }
})

export const {
  shortcutKeyRemoved,
} = shortcutsSlice.actions

const {
  shortcutKeyAddedOrReplaced,
  shortcutActionAddedOrReplaced,
} = shortcutsSlice.actions

export type KeyAlreadyInUseException<T extends keyof ShortcutsState = keyof ShortcutsState> = {
  readonly error: "KeyAlreadyInUseException"
  readonly stateKey: T
  readonly action: T extends "generalShortcuts" ? ValidControlName : string
  readonly key: Key
}

function keyAlreadyInUseException<T extends keyof ShortcutsState>(
  exception: Omit<KeyAlreadyInUseException<T>, "error">
): KeyAlreadyInUseException<T> {
  return {
    error: "KeyAlreadyInUseException",
    ...exception
  }
}

export class AssertError extends Error {}

export const createOrUpdateShortcutKey = createAsyncThunk<
boolean, {
  stateKey: keyof ShortcutsState,
  action: string,
  newKey: Key
  oldKey?: Key
}, ATConfig
>(
  "settings/shortcuts/createOrUpdateShortcutKey",
  async ({stateKey, action, newKey, oldKey} , {getState, dispatch, rejectWithValue}) =>  {
    if (oldKey && areEqualKeys(oldKey, newKey)) {
      return false
    }
    const state = getState().settings.shortcuts
    ObjectEntries(state).forEach(([loopStateKey, shortcutGroups]) => {
      const activeGroup = getActiveGroup(shortcutGroups)
      ObjectEntries(activeGroup.shortcuts).forEach(([loopAction, keys]) => {
        if (keys.some(key => areEqualKeys(key, newKey))) {
          if (loopStateKey === stateKey && loopAction === action) {
            dispatch(shortcutKeyRemoved(newKey))
          } else {
            throw rejectWithValue(keyAlreadyInUseException({
            stateKey: loopStateKey, action: loopAction, key: newKey}))
          }
        }
      })
    })
    if (!state[stateKey]) {
      throw new AssertError(`Called with non-existing stateKey: ${stateKey}`)
    }
    let currentAction = getActiveGroup(state[stateKey]).shortcuts[action] 
    if (!currentAction && stateKey === "generalShortcuts") {
      currentAction = []
    }
    if (!currentAction) {
      throw new AssertError(`Called with non-existing keys: ${stateKey} ${action}`)
    }
    if (oldKey && !currentAction.some(
      key => areEqualKeys(key, oldKey))) {
      throw new AssertError(`Called with non-existing old key: ${stateKey} ${action}`)
    }
    dispatch(shortcutKeyAddedOrReplaced({stateKey, action, newKey, oldKey}))
    return true
  }
)

export type ActionAlreadyInUseException = {
  readonly error: "ActionAlreadyInUseException"
  readonly stateKey: "subjectShortcuts" | "behaviourShortcuts"
  readonly newAction: string
  readonly oldAction?: string
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
boolean, {
  stateKey: "subjectShortcuts" | "behaviourShortcuts"
  newAction: string
  oldAction?: string
}, ATConfig
>(
  "settings/shortcuts/createOrUpdateAction",
  async ({stateKey, newAction, oldAction} , {getState, dispatch, rejectWithValue}) =>  {
    if (oldAction && oldAction === newAction) {
      return false
    }
    if (stateKey as string === "generalShortcuts") {
      throw new AssertError("Cannot change actions for General Shortcuts")
    }
    const shortcutGroups = getState().settings.shortcuts[stateKey]
    const activeGroup = getActiveGroup(shortcutGroups)
    const usedActions = new Set(ObjectKeys(activeGroup.shortcuts)
      .filter(s => s !== oldAction).map(s => s.trim().toLocaleLowerCase()))
    if (usedActions.has(newAction.trim().toLocaleLowerCase())) {
      throw rejectWithValue(actionAlreadyInUseException({
        stateKey, newAction, oldAction}))
    }
    dispatch(shortcutActionAddedOrReplaced({stateKey, oldAction, newAction}))
    return true
  }
)



const getActiveGroup = <T extends string>(groups: ShortcutGroups<T>) =>
   groups.groups[groups.selectedIndex] ?? groups.groups[0] ?? {name: "error", shortcuts: []}

export const selectGeneralShortcutGroups = (state: RootState) => state.settings.shortcuts.generalShortcuts as GeneneralShortcutGroups
export const selectActiveGeneralShortcutGroup = (state: RootState) => getActiveGroup(selectGeneralShortcutGroups(state))

export const selectSubjectShortcutGroups = (state: RootState) => state.settings.shortcuts.subjectShortcuts as GeneneralShortcutGroups
export const selectActiveSubjectShortcutGroup = (state: RootState) => getActiveGroup(selectSubjectShortcutGroups(state))

export const selectBehaviourShortcutGroups = (state: RootState) => state.settings.shortcuts.behaviourShortcuts as GeneneralShortcutGroups
export const selectActiveBehaviourShortcutGroup = (state: RootState) => getActiveGroup(selectBehaviourShortcutGroups(state))
