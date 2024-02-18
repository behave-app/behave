// store.ts
import { configureStore } from '@reduxjs/toolkit';
import {useDispatch } from "react-redux"
import {videoFileSlice} from "./videoFileSlice"
import {videoPlayerSlice} from "./videoPlayerSlice"
import {detectionsDirectorySlice} from './detectionsSlice'
import {behaviourSlice} from './behaviourSlice'
import {appSlice} from './appSlice';
import {settingsReducer} from './settingsSlice';
import { shortcutsToLocalStorage } from './shortcutsSlice';
import { generalSettingsToLocalStorage } from './generalSettingsSlice';
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

export type ATConfig = {
  state: RootState
  dispatch: AppDispatch
}


export const store = configureStore({
  reducer: {
    [appSlice.name]: appSlice.reducer,
    settings: settingsReducer,
    [detectionsDirectorySlice.name]: detectionsDirectorySlice.reducer,
    [behaviourSlice.name]: behaviourSlice.reducer,
    [videoFileSlice.name]: videoFileSlice.reducer,
    [videoPlayerSlice.name]: videoPlayerSlice.reducer,
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

type Callback<T> = {
  selector: (state: RootState) => T
  callbackFn: (selected: T) => void
  debouce: boolean
  lastSavedState: T
  debouceTimeout: undefined | number
}

function createCallback<T>(
el: Omit<Callback<T>, "lastSavedState" | "debouceTimeout">
): Callback<T> {
return {
    ...el,
    lastSavedState: el.selector(store.getState()),
    debouceTimeout: undefined
}
}

const callbacks = {
  shortcuts: createCallback({
    selector: state=> state.settings.shortcuts,
    callbackFn: shortcutsToLocalStorage,
    debouce: true
  }),
  general: createCallback({
    selector: state=> state.settings.general,
    callbackFn: generalSettingsToLocalStorage,
    debouce: true
  }),
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkCallback(callback: Callback<any>) {
  if (callback.debouceTimeout !== undefined) {
    // already queued, doing nothing
    return
  }
  const saveIfChanged = () => {
    const newState = callback.selector(store.getState())
    if (newState === callback.lastSavedState) {
      return
    }
    callback.debouceTimeout = undefined
    callback.lastSavedState = newState
    callback.callbackFn(newState)
  }
  if (callback.debouce) {
    if (callback.debouceTimeout !== undefined) {
      // already debouncing
      return
    } else {
      callback.debouceTimeout = window.setTimeout(saveIfChanged, 100)
    }
  } else {
    saveIfChanged()
  }
}

store.subscribe(() => {
  Object.values(callbacks).forEach(c => checkCallback(c))
})

export default store;
