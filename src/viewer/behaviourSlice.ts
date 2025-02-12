import { createAsyncThunk, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { AppDispatch, ATConfig, RootState } from './store'
import { BehaveLayout, } from './generalSettingsSlice'
import { assert, } from '../lib/util'

export type BehaviourLine = Array<string>

export type BehaviourInfo = {
  filename: string
  layout: BehaveLayout
  readonly: boolean
  currentlySelectedLine: null | number
  currentlyEditing: null | {fieldIndex: number, type: "subject" | "behaviour" | "free"}
  currentlySelectedSubject: null | string
  lines: BehaviourLine[]
}

export type BehaviourData = {
  fileHandle: FileSystemFileHandle | null
  behaviourInfo: BehaviourInfo | null
  retryCount: number // used to trigger save retries
}

const initialState: BehaviourData = {
  fileHandle: null,
  behaviourInfo: null,
  retryCount: 0,
}

export function numberSort<T>(keyFunc: (item: T) => number): (a: T, b: T) => number;
export function numberSort<T extends number>(keyFunc?: (item: T) => number): (a: T, b: T) => number;
export function numberSort<T>(keyFunc?: (item: T) => number): (a: T, b: T) => number {
  const definedKeyFunc = keyFunc ?? ((item: number) => item) as (item: T) => number
  return (a: T, b: T) => definedKeyFunc(a) - definedKeyFunc(b)
}

export function getColumnNamesFromLayout(behviourLayout: BehaveLayout): string[] {
  return behviourLayout.map(
    col => {
      const prefices = ["dateTime:", "comments:"]
      for (const prefix of prefices) {
        if (col.type.startsWith(prefix)) {
          return col.type.slice(prefix.length)
        }
      }
      return col.type
    }
  )
}

export const behaviourSlice = createSlice({
  name: "behaviour",
  initialState,
  reducers: {
    behaviourInfoUnset: (state) => {
      state.fileHandle = null
      state.behaviourInfo = null
    },
    behaviourInfoSavedAs: (state, {payload}: PayloadAction<{
      fileHandle: FileSystemFileHandle,
    }>) => {
      assert(state.behaviourInfo)
      state.fileHandle = payload.fileHandle
      state.behaviourInfo.readonly = false
    },
    behaviourInfoLinesSet: (state, {payload}: PayloadAction<{
      filename: string,
      layout: BehaveLayout
      lines: string[][]
    }>) => {
      assert(validateDataIsBehaviourLines(payload.lines, payload.layout))
      state.fileHandle = null
      state.behaviourInfo = {
        ...payload,
        readonly: true,
        currentlySelectedLine: null,
        currentlyEditing: null,
        currentlySelectedSubject: null,
      }
    },
    behaviourInfoCreatedNew: (state, action: PayloadAction<{
      layout: BehaveLayout
      fileHandle: FileSystemFileHandle,
    }>) => {
      state.fileHandle = action.payload.fileHandle
      state.behaviourInfo = {
        filename: action.payload.fileHandle.name,
        layout: action.payload.layout,
        readonly: false,
        currentlySelectedLine: null,
        currentlySelectedSubject: null,
        currentlyEditing: null,
        lines: [getColumnNamesFromLayout(action.payload.layout)],
      }
    },
    behaviourInfoCurrentlySelectedSubjectToggle: (state, action: PayloadAction<string>) => {
      assert(state.behaviourInfo)
      assert(state.behaviourInfo.readonly === false)
      if (state.behaviourInfo.currentlySelectedSubject === action.payload) {
        state.behaviourInfo.currentlySelectedSubject = null
      } else {
        state.behaviourInfo.currentlySelectedSubject = action.payload
      }
    },
    behaviourInfoSubjectUnselected: (state) => {
      assert(state.behaviourInfo)
      state.behaviourInfo.currentlySelectedSubject = null
    },
    behaviourInfoLineAdded: (state, action: PayloadAction<{
      line: BehaviourLine,
      insertIndex: number,
    }>) => {
      assert(state.behaviourInfo)
      assert(state.behaviourInfo.readonly === false)
      state.behaviourInfo.lines.splice(
        action.payload.insertIndex, 0, action.payload.line)
    },
    behaviourInfoLineRemoved: (state, action: PayloadAction<number>) => {
      assert(state.behaviourInfo)
      assert(state.behaviourInfo.readonly === false)

      const getFrameNumber = (index: number | null) => {
        if (index === null) {
          return null
        }
        assert(state.behaviourInfo)
        assert(state.behaviourInfo.readonly === false)
        const frameNumberIndex = state.behaviourInfo.layout.findIndex(
          col => col.type === "frameNumber")
        if (state.behaviourInfo.lines[index] === undefined) {
          return null
        }
        return parseInt(state.behaviourInfo.lines[index][frameNumberIndex])

      }
      const currentFrameNumber =
        getFrameNumber(state.behaviourInfo.currentlySelectedLine)
      state.behaviourInfo.lines.splice(
        action.payload, 1)

      // fix currentlySelectedLine
      if (action.payload === state.behaviourInfo.currentlySelectedLine) {
        const selectedIndex = action.payload
        if (getFrameNumber(selectedIndex) === currentFrameNumber) {
          // keep current selected line, turns out the next line was for the same framenumber
        } else if(getFrameNumber(selectedIndex - 1) === currentFrameNumber) {
          state.behaviourInfo.currentlySelectedLine = selectedIndex - 1
        } else {
          state.behaviourInfo.currentlySelectedLine = null;
        }
      }
    },
    behaviourInfoFieldEdited: (state, action: PayloadAction<{
      lineNumber: number, fieldIndex: number, newContent: string
    }>) => {
      assert(state.behaviourInfo)
      assert(state.behaviourInfo.readonly === false)
      const line = state.behaviourInfo.lines[action.payload.lineNumber]
      const field = (line ?? [])[action.payload.fieldIndex]
      if (field === undefined) {
        throw new Error("Line / Field do not exist")
      }
      line[action.payload.fieldIndex] = action.payload.newContent
    },
    triggerSaveRetry: (state) => {
      state.retryCount = state.retryCount + 1
    },
    currentlySelectedLineUpdated: (state, action: PayloadAction<number>) => {
      assert(state.behaviourInfo)
      state.behaviourInfo.currentlySelectedLine = action.payload
    },
    currentlySelectedLineUnset: (state) => {
      assert(state.behaviourInfo)
      state.behaviourInfo.currentlySelectedLine = null
      state.behaviourInfo.currentlyEditing = null
    },
    currentlyEditingSet: (state, {payload}: PayloadAction<{
      currentlyEditing: BehaviourInfo["currentlyEditing"]
      currentlySelectedLine?: number
    }>) => {
      assert(state.behaviourInfo)
      assert(state.behaviourInfo.readonly === false)
      if ("currentlySelectedLine" in payload
        && payload.currentlySelectedLine !== undefined) {
        state.behaviourInfo.currentlySelectedLine = payload.currentlySelectedLine
      }
      state.behaviourInfo.currentlyEditing = payload.currentlyEditing
    },
  }
})

export const {
  behaviourInfoUnset,
  behaviourInfoSavedAs,
  behaviourInfoLinesSet,
  behaviourInfoCreatedNew,
  behaviourInfoSubjectUnselected,
  currentlySelectedLineUpdated,
  currentlySelectedLineUnset,
  triggerSaveRetry,
} = behaviourSlice.actions
export default behaviourSlice.reducer

const {
  currentlyEditingSet,
  behaviourInfoLineAdded,
  behaviourInfoLineRemoved,
  behaviourInfoFieldEdited,
  behaviourInfoCurrentlySelectedSubjectToggle,
} = behaviourSlice.actions

export const selectBehaviourInfo = (state: RootState) => state.behaviour.behaviourInfo
export const selectCurrentlySelectedSubject = (state: RootState) => state.behaviour.behaviourInfo?.currentlySelectedSubject ?? null

export const selectBehaviourLinesAsCSV = createSelector([
  (state: RootState) => state.behaviour.behaviourInfo?.lines], lines => lines ? lines.map(
    line => line.map(
      word => [",", '"', "\n"].some(char => word.includes(char))
        ? `"${word.replaceAll('"', '""')}"` : word
    ).join(",")
  ).join("\n") + "\n" : null
)

export const selectBehaviourFileHandlerAndCsv = createSelector([
    (state: RootState) => state.behaviour.fileHandle,
    (state: RootState) => state.behaviour.retryCount,
  selectBehaviourLinesAsCSV
], ((fileHandle, _retries, csv) => ({
  fileHandle, csv}))
)

export const saveBehaviourToDisk = async (
  {fileHandle, csv}: {fileHandle: BehaviourData["fileHandle"], csv: string | null}
)=> {
  if (fileHandle === null || csv === null) {
    return
  }
  const output_stream = await fileHandle.createWritable()
  await output_stream.write(csv)
  await output_stream.close()
}

export const validateDataIsBehaviourLines = (
lines: string[][], behviourLayout: BehaveLayout
): boolean => {
  if (lines.length < 1) {
    console.warn("Should have at least one line")
    return false;
  }
  if (!getColumnNamesFromLayout(behviourLayout).every(
    (colname, index) => colname === lines[0][index])) {
    console.warn("First line should match layout (for now)", behviourLayout, lines[0])
    return false
  }
  if (!lines.every(line => line.length === behviourLayout.length)) {
    console.warn("Each line should have the same number of entries")
    return false
  }
  const frameNumberIndex = behviourLayout.findIndex(
    col => col.type === "frameNumber")
  if (!lines.slice(1).every(
    line => /^([1-9][0-9]*)|0$/.test(line[frameNumberIndex]))) {
    console.warn("All frame numbers should be int-strings")
    return false
  }
  return true
}

export const csvToLines = (csv: string): string[][] => {
  const lines = csv.split("\n")
  const partLines: string[][] = []
  for (let i=0; i < lines.length; i++) {
    let line: string | null = lines[i]
    if (line.length === 0) {
      console.debug("Skipping empty line")
      continue
    }
    if (lines[0] === "#") {
      console.debug("Skipping commment line")
      continue
    }
    const parts: string[] = []
    while (line !== null) {
      if (line[0] === '"') {
        let index = '"'.length // skip first quote
        while (true) {
          index = line.indexOf('"', index)
          if (index === -1) {
            // quoted enter
            i++
            line += lines[i]
          } else if (line[index + 1] === '"') {
            // quoted double quote
            index += 2
            continue
          } else if (line[index + 1] === "," || line[index + 1] === undefined) {
            // end of field
            parts.push(line.slice(1, index).replaceAll('""', '"'))
            line = line[index + 1] === "," ? line.slice(index + 2) : null
            break
          } else {
            throw new Error("Corrupt")
          }
        }
      } else {
        const index = line.indexOf(",")
        if (index === -1) {
          parts.push(line)
          line = null
        } else {
          parts.push(line.slice(0, index))
          line = line.slice(index + 1)
        }
      }
    }
    partLines.push(parts)
  }
  return partLines
}


export type NoWritableBehaviourFileException = {
  error: "NoWritableBehaviourFileException"
  reason: "no file" | "read only"
}

function noWritableBehaviourFileException (
  exception: Omit<NoWritableBehaviourFileException, "error">
): NoWritableBehaviourFileException {
  return {
    error: "NoWritableBehaviourFileException",
    ...exception
  }
}

export type BehaviourFileWriteException = {
  error: "BehaviourFileWriteException"
  reason: string,
}

export function behaviourFileWriteException (
  exception: Omit<BehaviourFileWriteException, "error">
): BehaviourFileWriteException {
  return {
    error: "BehaviourFileWriteException",
    ...exception
  }
}

function checkEditableThunkCreator<T>(
  func: (params: T) => Parameters<AppDispatch>[0]
) {
  return createAsyncThunk<
    void, T, ATConfig<NoWritableBehaviourFileException>>
    (
      `behaviour/${func.toString()}WithEditableCheck`,
      async (params, {getState, dispatch, rejectWithValue}) => {
        const state = getState()
        if(state.behaviour.behaviourInfo === null) {
          throw rejectWithValue(noWritableBehaviourFileException({reason: "no file"}))

    }
    if (state.behaviour.behaviourInfo.readonly === true) {
      throw rejectWithValue(noWritableBehaviourFileException({reason: "read only"}))
    }
    dispatch(func(params))
  }
)
}

export const setCurrentlyEditing = checkEditableThunkCreator(
  currentlyEditingSet)

export const addBehaviourInfoLine = checkEditableThunkCreator(
  behaviourInfoLineAdded)

export const removeBehaviourInfoLine = checkEditableThunkCreator(
  behaviourInfoLineRemoved)

export const editBehaviourInfoLineField = checkEditableThunkCreator(
  behaviourInfoFieldEdited)

export const toggleBehaviourInfoCurrentlySelectedSubject = checkEditableThunkCreator(
  behaviourInfoCurrentlySelectedSubjectToggle)
