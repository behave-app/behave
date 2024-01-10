import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'

export const appSlice = createSlice({
  name: "app",
  initialState: {
    showSettingsScreen: false,
    shownFrameNumber: NaN,
  },
  reducers: {
    shownFrameNumberUpdated: (state, action: PayloadAction<number>) => {
      state.shownFrameNumber = action.payload
    },
    settingsScreenShown: state => {state.showSettingsScreen = true},
    settingsScreenHidden: state => {state.showSettingsScreen = false},
  }
})


export default appSlice.reducer

export const {shownFrameNumberUpdated, settingsScreenShown, settingsScreenHidden} = appSlice.actions

export const selectShownFrameNumber = (state: RootState) => state.app.shownFrameNumber
export const selectShowSettingsScreen = (state: RootState) => state.app.showSettingsScreen
