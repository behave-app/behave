// store.ts
import { configureStore } from '@reduxjs/toolkit';
import {useDispatch } from "react-redux"
import videoFileReducer from "./videoFileSlice.js"
import appReducer from "./appSlice.js"
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

const store = configureStore({
  reducer: {
    app: appReducer,
    videoFile: videoFileReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      ignoredActions: ["videoFile/videoFileAdded"],
      ignoredPaths: ["videoFile.file"],
    }
  })
});

export default store;
