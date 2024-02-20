import { createSlice, PayloadAction, SerializedError } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { createOrUpdateShortcutKey, type ActionAlreadyInUseException, type KeyAlreadyInUseException, type SwitchLeadsToDuplicateKeysException, createOrUpdateAction, switchActiveGroup } from './shortcutsSlice'

export type SidebarPopup = "info" | "classSliders" | "keyShortcuts"
export const zoomLevels = [1, 2, 3, 5] as const
export type ZoomLevel = number

export type AppError = SerializedError | ActionAlreadyInUseException | KeyAlreadyInUseException | SwitchLeadsToDuplicateKeysException

export const appSlice = createSlice({
  name: "app",
  initialState: {
    error: null as AppError | null,
    modalPopupOpen: false,
    shortcutsAreBlocked: 0,
    sidebarPopup: null as SidebarPopup | null,
    selectedSubject: null  as null | string,
    hideDetectionBoxes: false,
    zoom: 0 as ZoomLevel,
  },
  reducers: {
    appErrorSet: (state, {payload: error}: PayloadAction<AppError>) => {
      state.error = error},
    appErrorCleared: state => {state.error = null},
    sidebarPopupWasToggled: (state, {payload}: PayloadAction<SidebarPopup>) => {
      state.sidebarPopup = (state.sidebarPopup === payload ? null : payload)
    },
    sidebarPopupWasClosed: state => {state.sidebarPopup = null},
    modalPopupOpened: state => {state.modalPopupOpen = true},
    modalPopupClosed: state => {state.modalPopupOpen = false},
    behaviourInputSubjectToggle: (state, action: PayloadAction<string>) => {
      if (state.selectedSubject === action.payload) {
        state.selectedSubject = null
      } else {
        state.selectedSubject = action.payload
      }
    },
    behaviourInputSubjectUnselected: (state) => {
      state.selectedSubject = null},
    hideDetectionBoxesToggled: state => {
      state.hideDetectionBoxes = !state.hideDetectionBoxes},
    zoomToggled: (state) => {
      state.zoom = state.zoom === 0 ? 1 : 0},
    zoomSet: (state, {payload}: PayloadAction<ZoomLevel>) => {
      state.zoom = payload},
    shortcutsAreBlockedMore: state => {state.shortcutsAreBlocked++},
    shortcutsAreBlockedLess: state => {
      state.shortcutsAreBlocked = Math.max(0, state.shortcutsAreBlocked - 1)},
  },
  extraReducers: builder => {
    builder
      .addCase(createOrUpdateShortcutKey.rejected, (state, action) => {
        state.error = action.payload as AppError
      })
      .addCase(createOrUpdateAction.rejected, (state, action) => {
        state.error = action.payload as AppError
      })
      .addCase(switchActiveGroup.rejected, (state, action) => {
        state.error = action.payload as AppError
      })
  }
})


export default appSlice.reducer

export const {appErrorSet, appErrorCleared, modalPopupOpened, modalPopupClosed, behaviourInputSubjectToggle, behaviourInputSubjectUnselected, sidebarPopupWasToggled, sidebarPopupWasClosed, hideDetectionBoxesToggled, zoomToggled, zoomSet, shortcutsAreBlockedMore, shortcutsAreBlockedLess} = appSlice.actions

export const selectSidebarPopup = (state: RootState) => state.app.sidebarPopup
export const selectSelectedSubject = (state: RootState) => state.app.selectedSubject
export const selectAppError = (state: RootState) => state.app.error
export const selectModalPopupIsOpen = (state: RootState) => state.app.modalPopupOpen
export const selectShortcutsAreBlocked = (state: RootState) => state.app.shortcutsAreBlocked > 0

export const selectIsWaitingForSubjectShortcut = (state: RootState) => (
  !!(state.videoFile
    && !state.app.modalPopupOpen
    && state.behaviour.behaviourInfo)
)

export const selectIsWaitingForBehaviourShortcut = (state: RootState) => (
  !!(state.videoFile
    && !state.app.modalPopupOpen
    && state.behaviour.behaviourInfo
    && state.app.selectedSubject !== null)
)
export const selectHideDetectionBoxes = (state: RootState) => state.app.hideDetectionBoxes
export const selectZoom = (state: RootState) => state.app.zoom
