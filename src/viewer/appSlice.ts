import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'

export type MainWindow = "VideoViewer" | "FileSelector"

export const appSlice = createSlice({
  name: "app",
  initialState: {
    mainWindow: "VideoViewer" as MainWindow
  },
  reducers: {
    mainWindowChanged: (state, action: PayloadAction<MainWindow>) => {
      state.mainWindow = action.payload
    }
  }
})


export default appSlice.reducer

export const selectMainWindow = (state: RootState) => state.app.mainWindow
