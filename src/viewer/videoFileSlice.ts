import type * as LibAVTypes from "../../public/app/bundled/libavjs/dist/libav.types";
import { createAsyncThunk, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { ATConfig, RootState } from './store'
import { ISODateTimeString, ISODATETIMESTRINGREGEX } from '../lib/detections'
import { EXTENSIONS } from "../lib/constants";
import { ArrayChecker, Checker, getCheckerFromObject, RecordChecker, StringChecker, UnionChecker } from "../lib/typeCheck";
import { ObjectEntries, ObjectKeys } from "../lib/util";

export type VideoFile = {
  file: File
  hash: string
  startTimestamps: Record<`${number}`, ISODateTimeString>
  recordFps: number | null
  frameTypeInfo: {
    iFrameInterval: number,
    iFrameStarts: number[],
    idrFrameInterval: number,
    idrFrameStarts: number[],
  } | null
  numberOfFrames: number
}

const videoFileExcludingFileChecker: Checker<Omit<VideoFile, "file">> = getCheckerFromObject({
  hash: new StringChecker({regexp: /^[0-9a-f]{16}$/}),
  startTimestamps: new RecordChecker({
    keyChecker: new StringChecker({regexp: /^[1-9][0-9*]|0$/}),
    valueChecker: new StringChecker(
      {regexp: ISODATETIMESTRINGREGEX}) as Checker<ISODateTimeString>,
  }, {valid: value => ObjectKeys(value).map(key => parseInt(key))
      .every((key, index, keys) => index === 0 || key > keys[index - 1])}),
  recordFps: new UnionChecker([1, null]),
  frameTypeInfo: new UnionChecker([{
    iFrameInterval: 1,
    iFrameStarts: new ArrayChecker(1),
    idrFrameInterval: 1,
    idrFrameStarts: new ArrayChecker(1),
  }, null]),
  numberOfFrames: 1,
})

export const videoFileSlice = createSlice({
  name: "videoFile",
  initialState: null as null | VideoFile,
  reducers: {
    videoFileSet: (_state, action: PayloadAction<VideoFile>) => {
      return action.payload
    },
  }
})

export const {videoFileSet} = videoFileSlice.actions

export default videoFileSlice.reducer

export const selectVideoFilePotentiallyNull = (state: RootState) => state.videoFile
export const selectVideoFileIsReady = (state: RootState): state is RootState & {videoFile: VideoFile} => {
  return state.videoFile !== null
}
export const selectVideoFile = (state: RootState): VideoFile => {
  if (!selectVideoFileIsReady(state)) {
    throw new Error("Wrong state")
  }
  return state.videoFile
}

export const selectVideoUrl = createSelector(
  [selectVideoFilePotentiallyNull],
  videoFile => videoFile === null ? null : URL.createObjectURL(videoFile.file)
)

export async function createSliceDataFromFile(file: File): Promise<VideoFile> {
  if (file.name.endsWith(EXTENSIONS.videoFile)) {
    const behaveData = await extractBehaveMetadata(file)
    if (ObjectKeys(behaveData).length) {
      const parsedBehaveData: {frameTypeInfo: Record<string, unknown>} & Record<string, unknown> = {
        frameTypeInfo: {},
      }
      for (const [key, value] of ObjectEntries(behaveData)) {
        const parsedValue = JSON.parse(value)
        switch (key) {
          case "iFrameInterval":
          case "iFrameStarts":
          case "idrFrameInterval":
          case "idrFrameStarts":
            parsedBehaveData.frameTypeInfo[key] = parsedValue
            break
          default:
            parsedBehaveData[key] = parsedValue
        }
      }
      if (videoFileExcludingFileChecker.isInstance(parsedBehaveData)) {
        return {file, ...parsedBehaveData}
      }
    }
  }
  throw new Error("Not done")
}
