// store.ts
import { configureStore } from '@reduxjs/toolkit';
import {useDispatch } from "react-redux"
import videoFileReducer from "./videoFileSlice.js"
import appReducer from "./appSlice.js"
import detectionsReducer from "./detectionsSlice.js"
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

const store = configureStore({
  reducer: {
    app: appReducer,
    detections: detectionsReducer,
    videoFile: videoFileReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    immutableCheck: {
      ignoredActions: ["videoFile/videoFileSet"],
      ignoredPaths: ["videoFile.file"],
    },
    serializableCheck: {
      ignoredActions: ["videoFile/videoFileSet"],
      ignoredPaths: ["videoFile.file"],
    },
  })
});

export default store;
