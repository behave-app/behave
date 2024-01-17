import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState, useAppDispatch } from './store'
import { BehaveLayout } from './settingsSlice'
import { selectCurrentFrameNumber } from './videoPlayerSlice'
import { DateTimeParts, SingleFrameInfo } from 'src/lib/detections'
import { selectCurrentFrameDateTime, selectCurrentFrameInfo, selectCurrentFrameInfoPotentiallyNull } from './detectionsSlice'
import { selectSelectedSubject } from './appSlice'

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
    },
  }
})

export const {behaviourDirectorySet, behaviourDirectoryUnset, behaviourInfoCreatedNew, behaviourInfoLineAdded, behaviourInfoFieldEdited, behaviourInfoUnset, currentlySelectedLineUpdated, currentlySelectedLineUnset} = behaviourSlice.actions

export default behaviourSlice.reducer

export const selectBehaviourDirectoryPotentiallyNull = (state: RootState) => state.behaviour
export const selectBehaviourDirectoryIsReady = (state: RootState): state is RootState & {behaviour: BehaviourDirectory} => {
  return state.behaviour !== null
}
export const selectBehaviourDirectory = (state: RootState): BehaviourDirectory => {
  if (!selectBehaviourDirectoryIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.behaviour
}

export const selectBehaviourInfo = (state: RootState) => state.behaviour.behaviourInfo

export const selectSelectedBehaviourLine: ((state: RootState) => null | {index: number, rel: "at" | "after"}) = createSelector(
  [(state) => selectCurrentFrameNumber(state), selectBehaviourInfo],
  (currentFrameNumber, behaviourInfo) => {
    if (!behaviourInfo) {
      return null
    }
    if (behaviourInfo.currentlySelectedLine !== null) {
      return {index: behaviourInfo.currentlySelectedLine, rel: "at"}
    }
    const frameNumberIndex = behaviourInfo.layout.findIndex(
      ({type}) => type === "frameNumber")
    const firstLineIndexEqualOrLarger = frameNumberIndex === -1 ? -1
      : behaviourInfo.lines.findIndex(
        line => parseInt(line[frameNumberIndex]) >= currentFrameNumber)
    return firstLineIndexEqualOrLarger === -1
      ? {index: behaviourInfo.lines.length - 1, rel: "after"}
      : currentFrameNumber === parseInt(
        behaviourInfo.lines[firstLineIndexEqualOrLarger][frameNumberIndex])
        ? {index: firstLineIndexEqualOrLarger, rel: "at"} : {index: firstLineIndexEqualOrLarger - 1, rel: "after"}
})


export const selectBehaviourLineWithoutBehaviour = createSelector(
[selectSelectedSubject, selectBehaviourInfo, (state) => selectCurrentFrameNumber(state), selectCurrentFrameInfoPotentiallyNull, selectCurrentFrameDateTime],
(selectedSubject, behaviourInfo, currentFrameNumber, currentFrameInfo, currentFrameDateTimeParts) => {
  if (!selectedSubject) {
    return null
  }
  if (!behaviourInfo) {
    throw new Error("No BehaviourInfo");
  }
  const parts: string[] = behaviourInfo.layout.map(({type}) => {
    if (type === "frameNumber") {
      return `${currentFrameNumber}`
    }
    if (type === "pts") {
      return currentFrameInfo ? `${currentFrameInfo.pts}` : "N/A"
    }
    if (type === "subject") {
      return selectedSubject
    }
    if (type === "behaviour") {
      return ""
    }
    if (type.startsWith("comments:")) {
      return ""
    }
    if (type.startsWith("dateTime:")) {
      const dateTimeParts = currentFrameDateTimeParts
      if (!dateTimeParts) {
        return "N/A"
      }
      const format = type.slice("dateTime:".length)

      return format
        .replace("%Y", dateTimeParts.year)
        .replace("%m", dateTimeParts.month)
        .replace("%d", dateTimeParts.day)
        .replace("%H", dateTimeParts.hour)
        .replace("%M", dateTimeParts.minute)
        .replace("%S", dateTimeParts.second)
        .replace("%Z", dateTimeParts.tz)
    }
    const exhaustive: `dateTime:${string}` | `comments:${string}` = type
    throw new Error("Exhausted: " + exhaustive)
  })
  return parts
})
