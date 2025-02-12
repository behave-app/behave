import { createAsyncThunk, createSlice, PayloadAction, SerializedError } from '@reduxjs/toolkit'
import type { ATConfig, RootState } from './store'
import {exportPreset, importPreset, type ShortcutPresetImportFailedException, type ShortcutPresetExportFailedException, type ShortcutsState } from './shortcutsSlice'
import { Key } from '../lib/key'
import { addBehaviourInfoLine, BehaviourFileWriteException, editBehaviourInfoLineField, NoWritableBehaviourFileException, removeBehaviourInfoLine, setCurrentlyEditing, toggleBehaviourInfoCurrentlySelectedSubject } from './behaviourSlice'

export type SidebarPopup = "info" | "classSliders" | "keyShortcuts" | "uploader" | "sizer"
export const MAX_ZOOM = 5

export type MultipleActionsAssignedToPressedKeyException = {
  error: "MultipleActionsAssignedToPressedKeyException",
  key: Key,
  actions: Array<{shortcutsStateKey: keyof ShortcutsState, action: string}>
}


export type AppError = (SerializedError & {error: "SerializedError"}) | ShortcutPresetImportFailedException | ShortcutPresetExportFailedException | MultipleActionsAssignedToPressedKeyException | NoWritableBehaviourFileException | BehaviourFileWriteException

export const appSlice = createSlice({
  name: "app",
  initialState: {
    error: null as AppError | null,
    sidebarPopup: "uploader" as SidebarPopup | null,
    hideDetectionBoxes: false,
    zoom: 0,
    lastKeyPressed: null as Key | null,
    fullscreen: false,
  },
  reducers: {
    appErrorSet: (state, {payload: error}: PayloadAction<AppError>) => {
      state.error = error},
    appErrorCleared: state => {state.error = null},
    sidebarPopupWasToggled: (state, {payload}: PayloadAction<SidebarPopup>) => {
      state.sidebarPopup = (state.sidebarPopup === payload ? null : payload)
    },
    sidebarPopupWasClosed: state => {state.sidebarPopup = null},
    hideDetectionBoxesToggled: state => {
      state.hideDetectionBoxes = !state.hideDetectionBoxes},
    zoomSet: (state, {payload: zoom}: PayloadAction<number>) => {
      state.zoom = Math.min(Math.max(0, zoom), MAX_ZOOM)},
    zoomChanged: (state, {payload: diff}: PayloadAction<number>) => {
      state.zoom = Math.min(Math.max(0, state.zoom + diff), MAX_ZOOM)},
    lastKeyPressedSet: (state, {payload}: PayloadAction<Key | null>) => {
      state.lastKeyPressed = payload},
    fullscreenSet: (state, {payload}: PayloadAction<boolean>) => {
      state.fullscreen = payload
    },
  },
  extraReducers: builder => {
    builder
      .addCase(exportPreset.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
      .addCase(importPreset.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
      .addCase(setCurrentlyEditing.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
      .addCase(removeBehaviourInfoLine.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
      .addCase(editBehaviourInfoLineField.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
      .addCase(addBehaviourInfoLine.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
      .addCase(toggleBehaviourInfoCurrentlySelectedSubject.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
  }
})

export default appSlice.reducer

export const {
  appErrorSet,
  appErrorCleared,
  sidebarPopupWasToggled,
  sidebarPopupWasClosed,
  hideDetectionBoxesToggled,
  zoomSet,
  zoomChanged,
  lastKeyPressedSet,
  fullscreenSet,
} = appSlice.actions


export const selectSidebarPopup = (state: RootState) => state.app.sidebarPopup
export const selectAppError = (state: RootState) => state.app.error
export const selectFullscreen = (state: RootState) => state.app.fullscreen

export const selectIsWaitingForSubjectShortcut = (state: RootState) => (
  !!(state.videoFile)
)

export const selectIsWaitingForBehaviourShortcut = (state: RootState) => (
  !!(state.videoFile
    && state.behaviour.behaviourInfo
    && state.behaviour.behaviourInfo.currentlySelectedSubject !== null)
)
export const selectHideDetectionBoxes = (state: RootState) => state.app.hideDetectionBoxes
export const selectZoom = (state: RootState) => state.app.zoom
export const selectZoomLevel = (state: RootState) => 2 ** state.app.zoom
export const selectLastKeyPressed = (state: RootState) => state.app.lastKeyPressed

export const toggleFullscreen = createAsyncThunk<void, void, ATConfig>(
  "app/toggleFullscreen",
  async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  }
)
