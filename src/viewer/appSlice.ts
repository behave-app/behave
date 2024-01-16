import { createSlice, } from '@reduxjs/toolkit'
import { RootState } from './store'

export const appSlice = createSlice({
  name: "app",
  initialState: {
    showSettingsScreen: false,
  },
  reducers: {
    settingsScreenShown: state => {state.showSettingsScreen = true},
    settingsScreenHidden: state => {state.showSettingsScreen = false},
  }
})


export default appSlice.reducer

export const {settingsScreenShown, settingsScreenHidden} = appSlice.actions

export const selectShowSettingsScreen = (state: RootState) => state.app.showSettingsScreen
