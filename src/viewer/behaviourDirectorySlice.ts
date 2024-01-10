import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from './store'

export type BehaviourDirectory = {
  directory: FileSystemDirectoryHandle
}

export const behaviourDirectorySlice = createSlice({
  name: "behaviourDirectory",
  initialState: null as null | BehaviourDirectory,
  reducers: {
    behaviourDirectorySet: (_state, action: PayloadAction<BehaviourDirectory>) => {
      return action.payload
    },
  }
})

export const {behaviourDirectorySet} = behaviourDirectorySlice.actions

export default behaviourDirectorySlice.reducer

export const selectBehaviourDirectoryPotentiallyNull = (state: RootState) => state.behaviourDirectory
export const selectBehaviourDirectoryIsReady = (state: RootState): state is RootState & {behaviourDirectory: BehaviourDirectory} => {
  return state.behaviourDirectory !== null
}
export const selectBehaviourDirectory = (state: RootState): BehaviourDirectory => {
  if (!selectBehaviourDirectoryIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.behaviourDirectory
}
