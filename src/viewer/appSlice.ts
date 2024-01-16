import { createSlice, PayloadAction} from '@reduxjs/toolkit'
import { RootState } from './store'

export const appSlice = createSlice({
  name: "app",
  initialState: {
    showSettingsScreen: false,
    modalPopupOpen: false,
    selectedSubject: null  as null | string
  },
  reducers: {
    settingsScreenShown: state => {state.showSettingsScreen = true},
    settingsScreenHidden: state => {state.showSettingsScreen = false},
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

export const {settingsScreenShown, settingsScreenHidden, modalPopupOpened, modalPopupClosed, behaviourInputSubjectToggle, behaviourInputSubjectUnselected} = appSlice.actions

export const selectSelectedSubject = (state: RootState) => state.app.selectedSubject
export const selectShowSettingsScreen = (state: RootState) => state.app.showSettingsScreen
export const selectModalPopupIsOpen = (state: RootState) => state.app.modalPopupOpen

export const selectIsWaitingForVideoShortcut = (state: RootState) => (
  !state.app.showSettingsScreen
    && state.videoFile
    && !state.app.modalPopupOpen
    && state.app.selectedSubject === null
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
