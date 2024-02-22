import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { assert } from '../lib/util'
import {HSL} from "../lib/colour"
import { Checker, LiteralChecker, RecordChecker, StringChecker, UnionChecker, getCheckerFromObject } from '../lib/typeCheck';


export type SettingsForDetectionClass = {
  name: string, // classname
  confidenceCutoff: number,
  hide: boolean,
  colour: HSL,
  alpha: number,
}


export type ConfidenceLocation = `${"outer" | "inner"}-${"left" | "center" | "right"}-${"top" | "bottom"}` | "off"
/**
 * OK, we need this internal settings state, to avoid some nasty annoying
  * circular reference.
  * VideoShortcut depends on keyof CONTROLS, however in order to get those keys,
  * the system wants to get all the data (even though the keys are const....
*/
export type GeneralSettingsState = {
  settingsByDetectionClass: null | Record<`${number}`, SettingsForDetectionClass>
  confidenceLocation: ConfidenceLocation
  showPlayerInfo: boolean
}

const defaultGeneralSettings: GeneralSettingsState = {
  settingsByDetectionClass: null,
  confidenceLocation: "outer-right-bottom",
  showPlayerInfo: true,
}

export const generalSettingsChecker: Checker<GeneralSettingsState> = getCheckerFromObject({
    settingsByDetectionClass: new UnionChecker([null, new RecordChecker({
      keyChecker: new StringChecker({regexp: /0|[1-9][0-9]*/}),
      valueChecker: {
        name: "",
        confidenceCutoff: 0,
        hide: true,
        colour: {h: 0, s: 0, l: 0},
        alpha: 0,
      }
    })]),
    confidenceLocation: new LiteralChecker<ConfidenceLocation>([
      "outer-left-top", "outer-center-top", "outer-right-top",
      "inner-left-top", "inner-center-top", "inner-right-top",
      "inner-left-bottom", "inner-center-bottom", "inner-right-bottom",
      "outer-left-bottom", "outer-center-bottom", "outer-right-bottom",
    ]),
    showPlayerInfo: true,
})

const LOCAL_STORAGE_GENERAL_SETTINGS_KEY = "Behave_General_Settings"
const LOCAL_STORAGE_GENERAL_SETTINGS_VERSION = 1 as const
export const generalSettingsToLocalStorage = (generalSettingsState: GeneralSettingsState) => {
  const settingsJSON = JSON.stringify(
    {version: LOCAL_STORAGE_GENERAL_SETTINGS_VERSION, general: generalSettingsState}
  )
  window.localStorage.setItem(LOCAL_STORAGE_GENERAL_SETTINGS_KEY, settingsJSON)
  console.debug("General settings saved to localStorage")
}

const getGeneralSettingsFromLocalStorageOrDefault = (): GeneralSettingsState => {
  const logDefault = (...args: unknown[]) => {
    console.log("getGeneralSettingsFromLocalStorageOrDefault default restored: ", ...args)
  }
  const generalSettingsJSON = window.localStorage.getItem(LOCAL_STORAGE_GENERAL_SETTINGS_KEY)
  if (generalSettingsJSON === null) {
    logDefault("JSON file not found in localStorage")
    return defaultGeneralSettings
  }
  let savedGeneralSettings: unknown
  try {
    savedGeneralSettings = JSON.parse(generalSettingsJSON)
  } catch (e) {
    logDefault("JSON parse failed")
    return defaultGeneralSettings
  }
  const savedShortcutsStateChecker = getCheckerFromObject({
    version: new LiteralChecker(LOCAL_STORAGE_GENERAL_SETTINGS_VERSION),
    general: generalSettingsChecker,
  })
  if (!savedShortcutsStateChecker.isInstance(savedGeneralSettings)) {
    logDefault("Checker failed")
    return defaultGeneralSettings
  }
  return savedGeneralSettings.general
}


export const generalSettingsSlice = createSlice({
  name: "general",
  initialState: getGeneralSettingsFromLocalStorageOrDefault(),
  reducers: {
    settingsUpdated: (_state, action: PayloadAction<GeneralSettingsState>) => {
      return action.payload
    },
    settingsByDetectionClassUpdated: (state, {payload}: PayloadAction<null | Record<`${number}`, SettingsForDetectionClass>>) => {
      state.settingsByDetectionClass = payload
    },
    confidenceCutoffUpdated: (state, {payload: {klass, newConfidenceCutoff}}: PayloadAction<{klass: `${number}`, newConfidenceCutoff: number}>) => {
      if (!state.settingsByDetectionClass) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClass[klass].confidenceCutoff = Math.min(
        0.95, Math.max(newConfidenceCutoff, 0.1))
    },
    alphaUpdated: (state, {payload: {klass, newAlpha}}: PayloadAction<{klass: `${number}`, newAlpha: number}>) => {
      if (!state.settingsByDetectionClass) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClass[klass].alpha = Math.min(
        1, Math.max(newAlpha, 0.0))
    },
    colourUpdated: (state, {payload: {klass, newColour}}: PayloadAction<{klass: `${number}`, newColour: HSL}>) => {
      if (!state.settingsByDetectionClass) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClass[klass].colour = newColour
    },
    hideToggled: (state, {payload: {klass}}: PayloadAction<{klass: `${number}`}>) => {
      if (!state.settingsByDetectionClass) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClass[klass].hide = !state.settingsByDetectionClass[klass].hide
    },
    confidenceLocationUpdated: (state, action: PayloadAction<ConfidenceLocation>) => {
      state.confidenceLocation = action.payload
    },
    playerInfoToggled: state => {
      state.showPlayerInfo = !state.showPlayerInfo
    }
  }
})

export const {
  settingsByDetectionClassUpdated,
  confidenceCutoffUpdated,
  alphaUpdated,
  hideToggled,
  colourUpdated,
  confidenceLocationUpdated,
  playerInfoToggled,
} = generalSettingsSlice.actions

export const selectSettingsByDetectionClass = (state: RootState) => state.settings.general.settingsByDetectionClass
export const selectConfidenceLocation = (state: RootState) => state.settings.general.confidenceLocation

export const selectPlayerInfoShown = (state: RootState) => state.settings.general.showPlayerInfo

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
