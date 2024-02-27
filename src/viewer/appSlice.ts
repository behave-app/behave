import { createSlice, PayloadAction, SerializedError } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { type ActionAlreadyInUseException, createOrUpdateAction, exportPreset, importPreset, type ShortcutPresetImportFailedException, type ShortcutPresetExportFailedException, type ShortcutsState } from './shortcutsSlice'
import { Key } from '../lib/key'
import { addBehaviourInfoLine, editBehaviourInfoLineField, NoWritableBehaviourFileException, removeBehaviourInfoLine, setCurrentlyEditingFieldIndex, toggleBehaviourInfoCurrentlySelectedSubject } from './behaviourSlice'

export type SidebarPopup = "info" | "classSliders" | "keyShortcuts" | "uploader" | "sizer"
export const zoomLevels = [1, 2, 3, 5] as const
export type ZoomLevel = number

export type MultipleActionsAssignedToPressedKeyException = {
  error: "MultipleActionsAssignedToPressedKeyException",
  key: Key,
  actions: Array<{shortcutsStateKey: keyof ShortcutsState, action: string}>
}


export type AppError = (SerializedError & {error: "SerializedError"}) | ActionAlreadyInUseException | ShortcutPresetImportFailedException | ShortcutPresetExportFailedException | MultipleActionsAssignedToPressedKeyException | NoWritableBehaviourFileException

export const appSlice = createSlice({
  name: "app",
  initialState: {
    error: null as AppError | null,
    sidebarPopup: "uploader" as SidebarPopup | null,
    hideDetectionBoxes: false,
    zoom: 0 as ZoomLevel,
    lastKeyPressed: null as Key | null
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
    zoomToggled: (state) => {
      state.zoom = state.zoom === 0 ? 1 : 0},
    zoomSet: (state, {payload}: PayloadAction<ZoomLevel>) => {
      state.zoom = payload},
    lastKeyPressedSet: (state, {payload}: PayloadAction<Key | null>) => {
      state.lastKeyPressed = payload},
  },
  extraReducers: builder => {
    builder
      .addCase(createOrUpdateAction.rejected, (state, action) => {
        if (action.payload === undefined) {
          state.error = {error: "SerializedError", ...action.error}
        } else {
          state.error = action.payload
        }
      })
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
      .addCase(setCurrentlyEditingFieldIndex.rejected, (state, action) => {
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
  zoomToggled,
  zoomSet,
  lastKeyPressedSet
} = appSlice.actions


export const selectSidebarPopup = (state: RootState) => state.app.sidebarPopup
export const selectAppError = (state: RootState) => state.app.error

export const selectIsWaitingForSubjectShortcut = (state: RootState) => (
  !!(state.videoFile
    && state.detections.detectionInfo
  )
)

export const selectIsWaitingForBehaviourShortcut = (state: RootState) => (
  !!(state.videoFile
    && state.detections.detectionInfo
    && state.behaviour.behaviourInfo
    && state.behaviour.behaviourInfo.currentlySelectedSubject !== null)
)
export const selectHideDetectionBoxes = (state: RootState) => state.app.hideDetectionBoxes
export const selectZoom = (state: RootState) => state.app.zoom
export const selectLastKeyPressed = (state: RootState) => state.app.lastKeyPressed
