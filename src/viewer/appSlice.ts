import { createSlice, PayloadAction} from '@reduxjs/toolkit'
import type { RootState } from './store'

export type SidebarPopup = "info" | "classSliders"
export type Zoom = "off" | "follow_mouse" | `${"top" | "middle" | "bottom"}-${"left" | "center" | "right"}`

export const appSlice = createSlice({
  name: "app",
  initialState: {
    showSettingsScreen: false,
    showKeyShortcutHelp: false,
    modalPopupOpen: false,
    sidebarPopup: null as SidebarPopup | null,
    selectedSubject: null  as null | string,
    hideDetectionBoxes: false,
    zoom: "off" as Zoom,
  },
  reducers: {
    settingsScreenShown: state => {state.showSettingsScreen = true},
    settingsScreenHidden: state => {state.showSettingsScreen = false},
    sidebarPopupWasToggled: (state, {payload}: PayloadAction<SidebarPopup>) => {
      state.sidebarPopup = (state.sidebarPopup === payload ? null : payload)
    },
    sidebarPopupWasClosed: state => {state.sidebarPopup = null},
    keyShortcutHelpScreenShown: state => {state.showKeyShortcutHelp = true},
    keyShortcutHelpScreenHidden: state => {state.showKeyShortcutHelp = false},
    keyShortcutHelpScreenToggled: state => {
      state.showKeyShortcutHelp = !state.showKeyShortcutHelp},
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
    zoomSet: (state, {payload}: PayloadAction<Zoom>) => {
      state.zoom = payload},
    zoomFollowMouseToggle: state => {
      state.zoom = (state.zoom === "follow_mouse" ? "off" : "follow_mouse")},
  }
})


export default appSlice.reducer

export const {settingsScreenShown, settingsScreenHidden, modalPopupOpened, modalPopupClosed, behaviourInputSubjectToggle, behaviourInputSubjectUnselected, keyShortcutHelpScreenShown, keyShortcutHelpScreenHidden, keyShortcutHelpScreenToggled, sidebarPopupWasToggled, sidebarPopupWasClosed, hideDetectionBoxesToggled, zoomSet, zoomFollowMouseToggle} = appSlice.actions

export const selectSidebarPopup = (state: RootState) => state.app.sidebarPopup
export const selectSelectedSubject = (state: RootState) => state.app.selectedSubject
export const selectShowSettingsScreen = (state: RootState) => state.app.showSettingsScreen
export const selectShowKeyShortcutHelp = (state: RootState) => state.app.showKeyShortcutHelp && ! state.app.showSettingsScreen
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
