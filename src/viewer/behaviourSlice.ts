import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState, useAppDispatch } from './store'
import { BehaveLayout } from './settingsSlice'
import { selectCurrentFrameNumber } from './videoPlayerSlice'
import { DateTimeParts, SingleFrameInfo } from 'src/lib/detections'
import { selectCurrentFrameDateTime, selectCurrentFrameInfo } from './detectionsSlice'
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
  }
})

export const {behaviourDirectorySet, behaviourDirectoryUnset, behaviourInfoCreatedNew, behaviourInfoLineAdded, behaviourInfoFieldEdited, behaviourInfoUnset} = behaviourSlice.actions

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
export const selectBehaviourInfoLinesInsertIndexForCurrentFrame = (state: RootState) => {
  const behaviourInfo = selectBehaviourInfo(state)
  if (!behaviourInfo) {
    throw new Error("No BehaviourInfo");
  }
  const currentFrameNumber = selectCurrentFrameNumber(state)
  const frameNumberIndex = behaviourInfo.layout.findIndex(
    ({type}) => type === "frameNumber")
  const insertLineNumber = frameNumberIndex === -1 ? -1
    : behaviourInfo.lines.findIndex(
      line => parseInt(line[frameNumberIndex]) > currentFrameNumber)
  return insertLineNumber === -1 ? behaviourInfo.lines.length : insertLineNumber
}

export const selectBehaviourLineWithoutBehaviour = (
  state: RootState,
) => {
  const selectedSubject = selectSelectedSubject(state)
  if (!selectedSubject) {
    return null
  }
  const behaviourInfo = selectBehaviourInfo(state)
  if (!behaviourInfo) {
    throw new Error("No BehaviourInfo");
  }
  const parts: string[] = behaviourInfo.layout.map(({type}) => {
    if (type === "frameNumber") {
      return `${selectCurrentFrameNumber(state)}`
    }
    if (type === "pts") {
      return `${selectCurrentFrameInfo(state).pts}`
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
      const dateTimeParts = selectCurrentFrameDateTime(state)
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
}
