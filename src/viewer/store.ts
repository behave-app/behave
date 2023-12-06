// store.ts
import { configureStore } from '@reduxjs/toolkit';
import {useDispatch} from "react-redux"
import counterReducer from './reducer';
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch

const store = configureStore({
  reducer: {
    counter: counterReducer,
  }
});

export default store;
