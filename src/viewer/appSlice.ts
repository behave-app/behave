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
    behaviourInputSubjectSelected: (state, action: PayloadAction<string>) => {
      state.selectedSubject = action.payload},
    behaviourInputSubjectUnselected: (state) => {
      state.selectedSubject = null},
  }
})


export default appSlice.reducer

export const {settingsScreenShown, settingsScreenHidden} = appSlice.actions

export const selectShowSettingsScreen = (state: RootState) => state.app.showSettingsScreen
export const selectModalPopupIsOpen = (state: RootState) => state.app.modalPopupOpen

export const selectIsWaitingForVideoShortcut = (state: RootState) => (
  !state.app.showSettingsScreen
    && !state.app.modalPopupOpen
    && state.app.selectedSubject === null
)

export const selectIsWaitingForSubjectShortcut = (state: RootState) => (
  !state.app.showSettingsScreen
    && !state.app.modalPopupOpen
    && state.app.selectedSubject === null
)

export const selectIsWaitingForBehaviourShortcut = (state: RootState) => (
  !state.app.showSettingsScreen
    && !state.app.modalPopupOpen
    && state.app.selectedSubject !== null
)
