import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { assert, mayBeUndefined } from '../lib/util'
import {HSL} from "../lib/colour"
import { Checker, LiteralChecker, NumberChecker, RecordChecker, StringChecker, getCheckerFromObject } from '../lib/typeCheck';
import { DetectionInfo } from '../lib/detections';


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
  settingsByDetectionClassByKey: Record<string, Record<`${number}`, SettingsForDetectionClass>>
  confidenceLocation: ConfidenceLocation
  timeOffsetSeconds: number
  showControlPanel: boolean
  detectionBar: {visible: boolean, size: number}
  behaviourBar: {visible: boolean, size: number}
}

const defaultGeneralSettings: GeneralSettingsState = {
  settingsByDetectionClassByKey: {},
  confidenceLocation: "outer-right-bottom",
  timeOffsetSeconds: 0,
  showControlPanel: true,
  detectionBar: {visible: true, size: 10},
  behaviourBar: {visible: true, size: 10},
}

function isJSON(s: string): boolean {
  try {
    JSON.parse(s)
    return true
  } catch(_) {
    return false
  }
}

export const generalSettingsChecker: Checker<GeneralSettingsState> = getCheckerFromObject({
    settingsByDetectionClassByKey: new RecordChecker({
    keyChecker: new StringChecker({valid: isJSON}),
    valueChecker: new RecordChecker({
      keyChecker: new StringChecker({regexp: /0|[1-9][0-9]*/}),
      valueChecker: {
        name: "",
        confidenceCutoff: 0,
        hide: true,
        colour: {h: 0, s: 0, l: 0},
        alpha: 0,
      }
    })}),
    confidenceLocation: new LiteralChecker<ConfidenceLocation>([
      "outer-left-top", "outer-center-top", "outer-right-top",
      "inner-left-top", "inner-center-top", "inner-right-top",
      "inner-left-bottom", "inner-center-bottom", "inner-right-bottom",
      "outer-left-bottom", "outer-center-bottom", "outer-right-bottom",
    ]),
  timeOffsetSeconds: new NumberChecker({isFinite: true, isInt: true}),
    showControlPanel: true,
    detectionBar: {visible: true, size: new NumberChecker({min: 5, max: 45, isFinite: true,})},
    behaviourBar: {visible: true, size: new NumberChecker({min: 5, max: 45, isFinite: true,})},
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
  } catch (_e) {
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


export function getKeyFromModelKlasses(
  modelKlasses: DetectionInfo["modelKlasses"]
): string {
  // Note, we don't sort. Normally it should be sorted in the original definition
  // If not, then it just counts as another setting
  return JSON.stringify(modelKlasses)
}


export const generalSettingsSlice = createSlice({
  name: "general",
  initialState: getGeneralSettingsFromLocalStorageOrDefault(),
  reducers: {
    settingsUpdated: (_state, action: PayloadAction<GeneralSettingsState>) => {
      return action.payload
    },
    settingsByDetectionClassUpdated: (state, {payload}: PayloadAction<{modelKlasses: DetectionInfo["modelKlasses"], settingsByDetectionClass: Record<`${number}`, SettingsForDetectionClass>}>) => {
      const key = getKeyFromModelKlasses(payload.modelKlasses)
      state.settingsByDetectionClassByKey[key] = payload.settingsByDetectionClass
    },
    confidenceCutoffUpdated: (state, {payload: {modelKlasses, klass, newConfidenceCutoff}}: PayloadAction<{modelKlasses: DetectionInfo["modelKlasses"], klass: `${number}`, newConfidenceCutoff: number}>) => {
      const key = getKeyFromModelKlasses(modelKlasses)
      if (!mayBeUndefined((state.settingsByDetectionClassByKey[key] ?? {})[klass])) {
        console.error("No settingsByDetectionClass for key");
        return
      }
      state.settingsByDetectionClassByKey[key][klass].confidenceCutoff = Math.min(
        0.95, Math.max(newConfidenceCutoff, 0.1))
    },
    alphaUpdated: (state, {payload: {modelKlasses, klass, newAlpha}}: PayloadAction<{modelKlasses: DetectionInfo["modelKlasses"], klass: `${number}`, newAlpha: number}>) => {
      const key = getKeyFromModelKlasses(modelKlasses)
      if (!mayBeUndefined((state.settingsByDetectionClassByKey[key] ?? {})[klass])) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClassByKey[key][klass].alpha = Math.min(
        1, Math.max(newAlpha, 0.0))
    },
    colourUpdated: (state, {payload: {modelKlasses, klass, newColour}}: PayloadAction<{modelKlasses: DetectionInfo["modelKlasses"], klass: `${number}`, newColour: HSL}>) => {
      const key = getKeyFromModelKlasses(modelKlasses)
      if (!mayBeUndefined((state.settingsByDetectionClassByKey[key] ?? {})[klass])) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClassByKey[key][klass].colour = newColour
    },
    hideToggled: (state, {payload: {modelKlasses, klass}}: PayloadAction<{modelKlasses: DetectionInfo["modelKlasses"], klass: `${number}`}>) => {
      const key = getKeyFromModelKlasses(modelKlasses)
      if (!mayBeUndefined((state.settingsByDetectionClassByKey[key] ?? {})[klass])) {
        console.error("No settingsByDetectionClass");
        return
      }
      state.settingsByDetectionClassByKey[key][klass].hide = !state.settingsByDetectionClassByKey[key][klass].hide
    },
    confidenceLocationUpdated: (state, action: PayloadAction<ConfidenceLocation>) => {
      state.confidenceLocation = action.payload
    },
    controlPaneToggled: state => {
      state.showControlPanel = !state.showControlPanel
    },
    detectionBarToggled: state => {
      state.detectionBar.visible = !state.detectionBar.visible
    },
    detectionBarSizeSet: (state, {payload: newSize}: PayloadAction<number>) => {
      assert(Number.isFinite(newSize))
      state.detectionBar.size = Math.min(45, Math.max(5, newSize))
    },
    behaviourBarToggled: state => {
      state.behaviourBar.visible = !state.behaviourBar.visible
    },
    behaviourBarSizeSet: (state, {payload: newSize}: PayloadAction<number>) => {
      assert(Number.isFinite(newSize))
      state.behaviourBar.size = Math.min(45, Math.max(5, newSize))
    },
    timeOffsetSecondsSet: (state, {payload: newOffsetSeconds}: PayloadAction<number>) => {
      assert(Number.isFinite(newOffsetSeconds))
      assert(Number.isSafeInteger(newOffsetSeconds))
      state.timeOffsetSeconds = newOffsetSeconds
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
  controlPaneToggled,
  detectionBarToggled,
  detectionBarSizeSet,
  behaviourBarToggled,
  behaviourBarSizeSet,
  timeOffsetSecondsSet,
} = generalSettingsSlice.actions

export const selectSettingsByDetectionClassByKey = (state: RootState) => state.settings.general.settingsByDetectionClassByKey
export const selectConfidenceLocation = (state: RootState) => state.settings.general.confidenceLocation

export const selectControlPanelShown = (state: RootState) => state.settings.general.showControlPanel

export const selectDetectionBarSize = (state: RootState) => state.settings.general.detectionBar.size

export const selectDetectionBarShown = (state: RootState) => state.settings.general.detectionBar.visible

export const selectBehaviourBarSize = (state: RootState) => state.settings.general.behaviourBar.size

export const selectBehaviourBarShown = (state: RootState) => state.settings.general.behaviourBar.visible

export const selectTimeOffsetSeconds = (state: RootState) => state.settings.general.timeOffsetSeconds

export type BehaviourColoumnType = "frameNumber" | `dateTime:${string}` | "subject" | "behaviour" | `comments:${string}`
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
