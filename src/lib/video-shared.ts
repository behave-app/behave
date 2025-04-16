import { ArrayChecker, Checker, getCheckerFromObject, LiteralChecker, ObjectChecker, RecordChecker, StringChecker, UnionChecker } from "./typeCheck";
import { ISODateTimeString, ISODATETIMESTRINGREGEX } from "./datetime";


export type DefiniteFrameTypeInfo = {
    iFrameInterval: number,
    iFrameStarts: number[],
    idrFrameInterval: number | null,
    idrFrameStarts: number[],
  }

export type VideoMetadata = {
  hash: string 
  startTimestamps: Record<`${number}`, ISODateTimeString>
  recordFps: number | null
  frameTypeInfo: DefiniteFrameTypeInfo | null
  numberOfFrames: number
  avgPlaybackFps: number
  exactPtsInSeconds_s: "N/A" | number[]
}

export const definiteFrameTypeInfoChecker: ObjectChecker<DefiniteFrameTypeInfo, Record<never, never>> = getCheckerFromObject({
    iFrameInterval: 1,
    iFrameStarts: new ArrayChecker(1),
    idrFrameInterval: new UnionChecker([1, null]),  // will be null if only 1 idr frame
    idrFrameStarts: new ArrayChecker(1),
  })

export const videoMetadataChecker: ObjectChecker<VideoMetadata, Record<never, never>> = getCheckerFromObject({
  hash: new StringChecker({regexp: /^[0-9a-f]{16}$/}),
  startTimestamps: new RecordChecker({
    keyChecker: new StringChecker({regexp: /^-?[1-9][0-9]*|0$/}),
    valueChecker: new StringChecker(
      {regexp: ISODATETIMESTRINGREGEX}) as Checker<ISODateTimeString>,
  }),
  recordFps: new UnionChecker([1, null]),
  frameTypeInfo: new UnionChecker([definiteFrameTypeInfoChecker, null]),
  numberOfFrames: 1,
  avgPlaybackFps: 1,
  exactPtsInSeconds_s: new UnionChecker([new LiteralChecker("N/A"), new ArrayChecker(1)]),
})
