// store.ts
import { configureStore } from '@reduxjs/toolkit';
import {useDispatch } from "react-redux"
import videoFileReducer from "./videoFileSlice"
import videoPlayerReducer from "./videoPlayerSlice"
import appReducer from "./appSlice"
import settingsReducer, {settingsToLocalStorage, SettingsState} from "./settingsSlice"
import detectionsDirectoryReducer from './detectionsSlice'
import behaviourReducer from './behaviourSlice'
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

export const store = configureStore({
  reducer: {
    app: appReducer,
    settings: settingsReducer,
    detections: detectionsDirectoryReducer,
    behaviour: behaviourReducer,
    videoFile: videoFileReducer,
    videoPlayer: videoPlayerReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    immutableCheck: {
      ignoredActions: [
        "videoFile/videoFileSet",
        "detections/detectionsDirectorySet",
        "behaviour/behaviourDirectorySet",
        "videoFile/videoFileSet",
      ],
      ignoredPaths: [
        "videoFile.file",
        "detections.directory",
        "behaviour.directory",
      ],
    },
    serializableCheck: {
      ignoredActions: [
        "videoFile/videoFileSet",
        "detections/detectionsDirectorySet",
        "behaviour/behaviourDirectorySet",
        "videoFile/videoFileSet",
      ],
      ignoredPaths: [
        "videoFile.file",
        "detections.directory",
        "behaviour.directory",
      ],
    },
  })
});

let debouceTimeout: number | undefined = undefined
let savedSettings: SettingsState = store.getState().settings

store.subscribe(() => {
  if (debouceTimeout !== undefined) {
    // already queued, doing nothing
    return
  }
  if (store.getState().settings === savedSettings) {
    // no change, doing nothing
    return
  }
  console.log("Saving!")
  debouceTimeout = window.setTimeout(() => {
    debouceTimeout = undefined;
    savedSettings = store.getState().settings
    settingsToLocalStorage(savedSettings)
  }, 100)
})

export default store;
