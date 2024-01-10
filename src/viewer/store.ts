// store.ts
import { configureStore } from '@reduxjs/toolkit';
import {useDispatch } from "react-redux"
import videoFileReducer from "./videoFileSlice.js"
import appReducer from "./appSlice.js"
import detectionsDirectoryReducer from './detectionsDirectorySlice.js'
import behaviourDirectoryReducer from './behaviourDirectorySlice.js'
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

const store = configureStore({
  reducer: {
    app: appReducer,
    detectionsDirectory: detectionsDirectoryReducer,
    behaviourDirectory: behaviourDirectoryReducer,
    videoFile: videoFileReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    immutableCheck: {
      ignoredActions: [
        "videoFile/videoFileSet",
        "detectionsDirectory/detectionsDirectorySet",
        "behaviourDirectory/behaviourDirectorySet",
        "videoFile/videoFileSet",
      ],
      ignoredPaths: [
        "videoFile.file",
        "detectionsDirectory/directory",
        "behaviourDirectory/directory",
      ],
    },
    serializableCheck: {
      ignoredActions: [
        "videoFile/videoFileSet",
        "detectionsDirectory/detectionsDirectorySet",
        "behaviourDirectory/behaviourDirectorySet",
        "videoFile/videoFileSet",
      ],
      ignoredPaths: [
        "videoFile.file",
        "detectionsDirectory/directory",
        "behaviourDirectory/directory",
      ],
    },
  })
});

export default store;
