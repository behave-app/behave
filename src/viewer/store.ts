// store.ts
import { SerializedError, configureStore } from '@reduxjs/toolkit';
import {useDispatch } from "react-redux"
import {videoFileSlice} from "./videoFileSlice"
import {videoPlayerSlice} from "./videoPlayerSlice"
import {detectionsDirectorySlice} from './detectionsSlice'
import {behaviourFileWriteException, behaviourSlice, saveBehaviourToDisk, selectBehaviourFileHandlerAndCsv} from './behaviourSlice'
import {appErrorSet, appSlice} from './appSlice';
import {settingsReducer} from './settingsSlice';
import { shortcutsToLocalStorage } from './shortcutsSlice';
import { generalSettingsToLocalStorage } from './generalSettingsSlice';
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

export type ATConfig<R extends SerializedError | {error: string} = SerializedError | {error: string}> = {
  state: RootState
  dispatch: AppDispatch
  rejectValue: R
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
        "behaviour/behaviourInfoSavedAs",
        "behaviour/behaviourInfoCreatedNew",
      ],
      ignoredPaths: [
        "videoFile.file",
        "behaviour.fileHandle",
      ],
    },
    serializableCheck: {
      ignoredActions: [
        "videoFile/videoFileSet",
        "behaviour/behaviourInfoSavedAs",
        "behaviour/behaviourInfoCreatedNew",
      ],
      ignoredPaths: [
        "videoFile.file",
        "behaviour.fileHandle",
      ],
    },
  })
});

type Callback<T> = {
  selector: (state: RootState) => T
  callbackFn: (selected: T) => void | Promise<void>
  debouce: boolean
  errorHandler?: (error: string) => void
  lastSavedState: T
  lastResult: unknown
  debouceTimeout: undefined | number
}

function createCallback<T>(
el: Omit<Callback<T>, "lastSavedState" | "debouceTimeout" | "lastResult">
): Callback<T> {
return {
    ...el,
    lastSavedState: el.selector(store.getState()),
    lastResult: undefined,
    debouceTimeout: undefined,
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
  behaviourToDisk: createCallback({
    selector: selectBehaviourFileHandlerAndCsv,
    callbackFn: saveBehaviourToDisk,
    debouce: true,
    errorHandler: (error) => {
      store.dispatch(appErrorSet(behaviourFileWriteException({reason: error})))
    }
  }),
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkCallback(callback: Callback<any>) {
  if (callback.debouceTimeout !== undefined) {
    // already queued, doing nothing
    return
  }
  const saveIfChanged = async () => {
    callback.debouceTimeout = undefined
    const newState = callback.selector(store.getState())
    if (newState === callback.lastSavedState) {
      return
    }
    callback.lastSavedState = newState
    try {
      callback.lastResult = await callback.callbackFn(newState)
    } catch (error) {
      console.log("error in callback", error)
      if (callback.errorHandler) {
        callback.errorHandler(`${error}`)
      }
    }
  }

  if (callback.debouce) {
    // make sure new run can only be scheduled after old run finishes
    // If function is sync, this should alway resolve directly
    void(new Promise(resolve => resolve(callback.lastResult)).then(() => {
      if (callback.debouceTimeout !== undefined) {
        // already debouncing
        return
      } else {
        callback.debouceTimeout = window.setTimeout(saveIfChanged, 100)
      }
    }))
  } else {
    void(saveIfChanged())
  }
}

const setWindowDotStateForDebugging = () => {
  ;(window as unknown as {state: RootState}).state = store.getState()
}

store.subscribe(() => {
  Object.values(callbacks).forEach(c => checkCallback(c))
  setWindowDotStateForDebugging()
})
setWindowDotStateForDebugging()

export default store;
