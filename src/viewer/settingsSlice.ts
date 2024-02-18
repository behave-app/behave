import { Checker, getCheckerFromObject } from '../lib/typeCheck';
import { combineSlices, } from "@reduxjs/toolkit"
import {generalSettingsChecker, GeneralSettingsState, generalSettingsSlice} from "./generalSettingsSlice"
import {shortcutsSlice, ShortcutsState, shortcutsStateChecker} from "./shortcutsSlice"

export type SettingsState = {
  general: GeneralSettingsState
  shortcuts: ShortcutsState
}

export const settingsStateChecker: Checker<SettingsState> = getCheckerFromObject({
  general: generalSettingsChecker,
  shortcuts: shortcutsStateChecker,
})

export const settingsReducer = combineSlices(generalSettingsSlice, shortcutsSlice)
