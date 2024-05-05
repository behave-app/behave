import { ArrayChecker, Checker, getCheckerFromObject, ObjectChecker, RecordChecker, StringChecker, UnionChecker } from "./typeCheck";
import { ISODateTimeString, ISODATETIMESTRINGREGEX } from "./datetime";

export type VideoMetadata = {
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
  playbackFps: number
}

export const videoMetadataChecker: ObjectChecker<VideoMetadata, Record<never, never>> = getCheckerFromObject({
  hash: new StringChecker({regexp: /^[0-9a-f]{16}$/}),
  startTimestamps: new RecordChecker({
    keyChecker: new StringChecker({regexp: /^-?[1-9][0-9]*|0$/}),
    valueChecker: new StringChecker(
      {regexp: ISODATETIMESTRINGREGEX}) as Checker<ISODateTimeString>,
  }),
  recordFps: new UnionChecker([1, null]),
  frameTypeInfo: new UnionChecker([{
    iFrameInterval: 1,
    iFrameStarts: new ArrayChecker(1),
    idrFrameInterval: 1,
    idrFrameStarts: new ArrayChecker(1),
  }, null]),
  numberOfFrames: 1,
  playbackFps: 1,
})
