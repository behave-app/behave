import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import { BehaveLayout } from './generalSettingsSlice'

export type BehaviourDirectory = {
  directory: FileSystemDirectoryHandle
  behaviourFilesByFilename: Record<string, FileSystemFileHandle[]>
}

export type BehaviourLine = Array<string>


export type BehaviourInfo = {
  sourceFileName: string
  sourceFileXxHash64: string
  createdDateTime: string
  lastModifiedDateTime: string
  layout: BehaveLayout
  readonly: boolean
  currentlySelectedLine: null | number
  currentlyEditingFieldIndex: null | number
  lines: BehaviourLine[]
}

export type BehaviourData = {
  directory: BehaviourDirectory | null
  behaviourInfo: BehaviourInfo | null
}

const initialState: BehaviourData = {
  directory: null,
  behaviourInfo: null,
}

export function numberSort<T>(keyFunc: (item: T) => number): (a: T, b: T) => number;
export function numberSort<T extends number>(keyFunc?: (item: T) => number): (a: T, b: T) => number;
export function numberSort<T>(keyFunc?: (item: T) => number): (a: T, b: T) => number {
  const definedKeyFunc = keyFunc ?? ((item: number) => item) as (item: T) => number
  return (a: T, b: T) => definedKeyFunc(a) - definedKeyFunc(b)
}

export const behaviourSlice = createSlice({
  name: "behaviour",
  initialState,
  reducers: {
    behaviourDirectorySet: (state, action: PayloadAction<BehaviourDirectory>) => {
      state.directory =  action.payload
    },
    behaviourDirectoryUnset: (state) => { state.directory = null},
    behaviourInfoCreatedNew: (state, action: PayloadAction<{
      videoFileName: string,
      videoFileHash: string,
      createdDateTime: string,
      layout: BehaveLayout
    }>) => {
      state.behaviourInfo = {
        sourceFileName: action.payload.videoFileName,
        sourceFileXxHash64: action.payload.videoFileHash,
        createdDateTime: action.payload.videoFileName,
        lastModifiedDateTime: action.payload.videoFileName,
        layout: action.payload.layout,
        readonly: false,
        currentlySelectedLine: null,
        currentlyEditingFieldIndex: null,
        lines: [
          action.payload.layout.map(l => ["dateTime:", "comments:", ""].map(
            prefix => l.type.startsWith(prefix) ? l.type.slice(prefix.length) : "")
            .filter(s => s != "")[0])
        ],
      }
    },
    behaviourInfoLineAdded: (state, action: PayloadAction<{
      line: BehaviourLine,
      insertIndex: number,
    }>) => {
      if (!state.behaviourInfo) {
        throw new Error("No behaviour info")
      }
      state.behaviourInfo.lines.splice(
        action.payload.insertIndex, 0, action.payload.line)
    },
    behaviourInfoLineRemoved: (state, action: PayloadAction<number>) => {
      if (!state.behaviourInfo) {
        throw new Error("No behaviour info")
      }
      state.behaviourInfo.lines.splice(
        action.payload, 1)
    },
    behaviourInfoFieldEdited: (state, action: PayloadAction<{
      lineNumber: number, fieldNumber: number, newContent: string
    }>) => {
      if (!state.behaviourInfo) {
        throw new Error("No behaviour info")
      }
      const line = state.behaviourInfo.lines[action.payload.lineNumber]
      const field = (line ?? [])[action.payload.fieldNumber]
      if (field === undefined) {
        throw new Error("Line / Field do not exist")
      }
      line[action.payload.fieldNumber] = action.payload.newContent
    },
    behaviourInfoUnset: (state) => {state.behaviourInfo = null},
    currentlySelectedLineUpdated: (state, action: PayloadAction<number>) => {
      if (!state.behaviourInfo) {
        throw new Error("No behaviour info")
      }
      state.behaviourInfo.currentlySelectedLine = action.payload
    },
    currentlySelectedLineUnset: (state) => {
      if (!state.behaviourInfo) {
        throw new Error("No behaviour info")
      }
      state.behaviourInfo.currentlySelectedLine = null
      state.behaviourInfo.currentlyEditingFieldIndex = null
    },
    currentlyEditingFieldIndexSet: (state, action: PayloadAction<{currentlyEditingFieldIndex: number | null, currentlySelectedLine?: number}>) => {
      if (!state.behaviourInfo) {
        throw new Error("No behaviour info")
      }
      if ("currentlySelectedLine" in action.payload && action.payload.currentlySelectedLine) {
        state.behaviourInfo.currentlySelectedLine = action.payload.currentlySelectedLine
      }
      state.behaviourInfo.currentlyEditingFieldIndex = action.payload.currentlyEditingFieldIndex
    },
  }
})

export const {behaviourDirectorySet, behaviourDirectoryUnset, behaviourInfoCreatedNew, behaviourInfoLineAdded, behaviourInfoLineRemoved, behaviourInfoFieldEdited, behaviourInfoUnset, currentlySelectedLineUpdated, currentlySelectedLineUnset, currentlyEditingFieldIndexSet} = behaviourSlice.actions
export default behaviourSlice.reducer

export const selectBehaviourDirectoryPotentiallyNull = (state: RootState) => state.behaviour
export const selectBehaviourDirectoryIsReady = (state: RootState): state is RootState & {behaviour: BehaviourDirectory} => {
  return state.behaviour !== null
}
export const selectBehaviourDirectoryAssertNotNull = (state: RootState): BehaviourDirectory => {
  if (!selectBehaviourDirectoryIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.behaviour
}

export const selectBehaviourInfo = (state: RootState) => state.behaviour.behaviourInfo



