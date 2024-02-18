import { createSlice, PayloadAction} from '@reduxjs/toolkit'
import type { RootState } from './store'

export type SidebarPopup = "info" | "classSliders" | "keyShortcuts"
export const zoomLevels = [1, 2, 3, 5] as const
export type ZoomLevel = number


export const appSlice = createSlice({
  name: "app",
  initialState: {
    showSettingsScreen: false,
    modalPopupOpen: false,
    sidebarPopup: null as SidebarPopup | null,
    selectedSubject: null  as null | string,
    hideDetectionBoxes: false,
    zoom: 0 as ZoomLevel,
  },
  reducers: {
    settingsScreenShown: state => {state.showSettingsScreen = true},
    settingsScreenHidden: state => {state.showSettingsScreen = false},
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
  }
})


export default appSlice.reducer

export const {settingsScreenShown, settingsScreenHidden, modalPopupOpened, modalPopupClosed, behaviourInputSubjectToggle, behaviourInputSubjectUnselected, sidebarPopupWasToggled, sidebarPopupWasClosed, hideDetectionBoxesToggled, zoomToggled, zoomSet} = appSlice.actions

export const selectSidebarPopup = (state: RootState) => state.app.sidebarPopup
export const selectSelectedSubject = (state: RootState) => state.app.selectedSubject
export const selectShowSettingsScreen = (state: RootState) => state.app.showSettingsScreen
export const selectModalPopupIsOpen = (state: RootState) => state.app.modalPopupOpen

export const selectIsWaitingForVideoShortcut = (state: RootState) => (
  // NOTE: we do not require a video file, since some keys work without  (it's actually general shortcuts)
  !state.app.showSettingsScreen
    && !state.app.modalPopupOpen
)

export const selectIsWaitingForSubjectShortcut = (state: RootState) => (
  !state.app.showSettingsScreen
    && state.videoFile
    && !state.app.modalPopupOpen
    && state.behaviour.behaviourInfo
)

export const selectIsWaitingForBehaviourShortcut = (state: RootState) => (
  !state.app.showSettingsScreen
    && state.videoFile
    && !state.app.modalPopupOpen
    && state.behaviour.behaviourInfo
    && state.app.selectedSubject !== null
)
export const selectHideDetectionBoxes = (state: RootState) => state.app.hideDetectionBoxes
export const selectZoom = (state: RootState) => state.app.zoom
