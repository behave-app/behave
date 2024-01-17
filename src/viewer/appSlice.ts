import { createSlice, PayloadAction} from '@reduxjs/toolkit'
import { RootState } from './store'

export const appSlice = createSlice({
  name: "app",
  initialState: {
    showSettingsScreen: false,
    showKeyShortcutHelp: false,
    modalPopupOpen: false,
    selectedSubject: null  as null | string
  },
  reducers: {
    settingsScreenShown: state => {state.showSettingsScreen = true},
    settingsScreenHidden: state => {state.showSettingsScreen = false},
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
  }
})


export default appSlice.reducer

export const {settingsScreenShown, settingsScreenHidden, modalPopupOpened, modalPopupClosed, behaviourInputSubjectToggle, behaviourInputSubjectUnselected, keyShortcutHelpScreenShown, keyShortcutHelpScreenHidden, keyShortcutHelpScreenToggled} = appSlice.actions

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
