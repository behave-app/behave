import { createSelector } from "@reduxjs/toolkit";
import { selectBehaviourInfo, selectCurrentlySelectedSubject } from "./behaviourSlice";
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice";
import { SettingsForDetectionClass, getKeyFromModelKlasses, selectFramenumberIndexInLayout, selectSettingsByDetectionClassByKey, selectTimeOffsetSeconds } from './generalSettingsSlice';
import type { RootState } from './store';
import { selectCurrentTime } from "./videoPlayerSlice";
import { HSL } from "../lib/colour";
import { clampedAt, ObjectEntries, ObjectKeys, range } from "../lib/util";
import { DateTimeParts, getPartsFromTimestamp, offsetParts } from "../lib/datetime";
import { selectDefaultOffset, selectAvgFps, selectExactPtsInSeconds_s, selectMetadata } from "./videoFileSlice";


const DEFAULT_COLOURS_FOR_CLASSES = new Map([
  ["all", {h: 0, s: 0, l: 70}],
  ["unknown", {h: 0, s: 0, l: 0}],
  ["0", {h: 0, s: 100, l: 50}],
  ["1", {h: 120, s: 100, l: 50}],
  ["2", {h: 240, s: 100, l: 50}],
  ["3", {h: 60, s: 100, l: 50}],
  ["4", {h: 180, s: 100, l: 50}],
  ["5", {h: 300, s: 100, l: 50}],
])
const DEFAULT_CONFIDENCE_CUTOFF = 0.5;
const DEFAULT_ALPHA = 0.8;
const DEFAULT_HIDE = false;


export const selectSettingsByDetectionClassForCurrectDetections: ((state: RootState) => Map<`${number}`, SettingsForDetectionClass> | null) = createSelector(
  [selectSettingsByDetectionClassByKey, selectDetectionInfoPotentiallyNull], (settingsByDetectionClassByKey, detectionInfo) => {
    if (!detectionInfo) {
      return null
    }
    const key = getKeyFromModelKlasses(detectionInfo.modelKlasses)
    if (key in settingsByDetectionClassByKey) {
      return new Map(ObjectEntries(settingsByDetectionClassByKey[key]))
    }
    return new Map(ObjectEntries(detectionInfo.modelKlasses).map(
      ([key, name]) => [key, {
        name: name,
        confidenceCutoff: DEFAULT_CONFIDENCE_CUTOFF,
        hide: DEFAULT_HIDE,
        alpha: DEFAULT_ALPHA,
        colour: DEFAULT_COLOURS_FOR_CLASSES.get(key) ?? DEFAULT_COLOURS_FOR_CLASSES.get("unknown")!,
      }] as [`${number}`, SettingsForDetectionClass]))
  })

export const selectConfidenceCutoffByClass: ((state: RootState) => (Map<`${number}`, number> | null)) = createSelector(
  [selectSettingsByDetectionClassForCurrectDetections], (settingsByDetectionClass) => {
    if (!settingsByDetectionClass) {
      return null;
    }
    return new Map([...settingsByDetectionClass.entries()].map(
      ([key, {hide, confidenceCutoff}]) => [key, hide ? 100 : confidenceCutoff]))
  })

export const selectColoursForClasses: (
  (state: RootState) => null | Map<`${number}` | "all", HSL>
) = createSelector(
    [selectSettingsByDetectionClassForCurrectDetections], (settingsByDetectionClass) => {
      if (!settingsByDetectionClass) {
        return null;
      }
      return new Map([
        ...[...settingsByDetectionClass.entries()].map(
          ([key, {colour}]) => [key, colour]),
        ["all", DEFAULT_COLOURS_FOR_CLASSES.get("all")!],
      ] as [`${number}` | "all", HSL][])
    })

export const selectCurrentFrameNumber = createSelector(
  [selectCurrentTime, selectAvgFps, selectExactPtsInSeconds_s, selectDefaultOffset],
  (currentTime, avgFps, exactPtsInSeconds_s, offset) => {
    if (currentTime === null
      || avgFps === null
      || exactPtsInSeconds_s === null
      || !Number.isFinite(currentTime)
      || !Number.isFinite(avgFps)
      || !Number.isFinite(offset)) {
      return null
    }
    const estimatedFrameNumber = Math.round(currentTime * avgFps)
    if (exactPtsInSeconds_s === "N/A") {
      return estimatedFrameNumber + offset
    }
    const actualFrameTime = clampedAt(exactPtsInSeconds_s, estimatedFrameNumber)
    if (actualFrameTime > currentTime) {
      for (let i = estimatedFrameNumber - 1;; i--) {
        if ((exactPtsInSeconds_s[i] ?? -1) <= currentTime) {
          return i + offset
        }
      }
    }
    for (let i = estimatedFrameNumber + 1;; i++) {
      if ((exactPtsInSeconds_s[i] ?? -1) > currentTime) {
        return i - 1 + offset
      }
    }
  }
)
export const selectDateTimes = createSelector(
  [selectMetadata, selectTimeOffsetSeconds],
  (metadata, offsetSeconds): null | ReadonlyArray<DateTimeParts> => {
    if (metadata === null
      || ObjectKeys(metadata.startTimestamps).length === 0
      || metadata.recordFps === null) {
      return null
    }
    const recordFps = metadata.recordFps
    // sort because ObjectEntries(and JSON.stringify) doesn't sort negative numbers nicely
    const entries = ObjectEntries(metadata.startTimestamps).toSorted((
      [frameNrStringA], [frameNrStringB]) => parseInt(frameNrStringA) - parseInt(frameNrStringB))
    let lastExplicitParts = [parseInt(entries[0][0]), getPartsFromTimestamp(entries[0][1])] as const
    return range(metadata.numberOfFrames).reduce((parts_s, framenr) => {
      const explicitCurrentFrameTimestamp = metadata.startTimestamps[`${framenr}`]
      if (explicitCurrentFrameTimestamp !== undefined) {
        const parts = getPartsFromTimestamp(explicitCurrentFrameTimestamp)
        lastExplicitParts = [framenr, parts]
      }
      const seconds = (framenr - lastExplicitParts[0]) / recordFps + offsetSeconds
      parts_s.push(offsetParts(lastExplicitParts[1], {seconds}))
      return parts_s
    }, [] as Array<DateTimeParts>)
  })


export const selectCurrentFrameDateTime = (state: RootState) => {
  const currentFrameNumber = selectCurrentFrameNumber(state)
  const datetimes = selectDateTimes(state)
  if (!datetimes || currentFrameNumber === null) {
    return null
  }
  return datetimes[currentFrameNumber]
}

export const selectCurrentFrameInfoPotentiallyNull = createSelector(
  // using delayed selector, because of circulair import
  [selectCurrentFrameNumber, selectDetectionInfoPotentiallyNull],
  (currentFrameNumber, detectionInfo) => {
    if (!detectionInfo || currentFrameNumber === null) {
      return null
    }
    return detectionInfo.framesInfo[currentFrameNumber]
  }
)
export const selectCurrentFrameInfo = createSelector(
  // using delayed selector, because of circulair import
  [selectCurrentFrameNumber, selectDetectionInfoPotentiallyNull],
  (currentFrameNumber, detectionInfo) => {
    if (!detectionInfo || currentFrameNumber === null) {
      return null
    }
    return detectionInfo.framesInfo[currentFrameNumber]
  }
)

export const selectVisibleDetectionsForCurrentFrame = createSelector(
  // using delayed selector, because of circulair import
  [selectCurrentFrameNumber, selectDetectionInfoPotentiallyNull, selectConfidenceCutoffByClass],
  (currentFrameNumber, detectionInfo, confidenceCutoffByClass) => {
    if (!detectionInfo || currentFrameNumber === null || !confidenceCutoffByClass) {
      return null
    }
    return detectionInfo.framesInfo[currentFrameNumber]?.detections
      .filter(d => d.confidence >= confidenceCutoffByClass.get(`${d.klass}`)!) ?? []
  }
)


export const selectSelectedBehaviourLine: ((state: RootState) => null | {index: number, rel: "at" | "after"}) = createSelector(
  [selectCurrentFrameNumber, selectBehaviourInfo, selectFramenumberIndexInLayout],
  (currentFrameNumber, behaviourInfo, frameNumberIndex) => {
    if (!behaviourInfo || currentFrameNumber === null) {
      return null
    }
    if (behaviourInfo.currentlySelectedLine !== null) {
      return {index: behaviourInfo.currentlySelectedLine, rel: "at"}
    }
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
  [
    selectCurrentlySelectedSubject, selectBehaviourInfo, selectCurrentFrameNumber,
    selectCurrentFrameDateTime
  ],
  (
    selectedSubject, behaviourInfo, currentFrameNumber,
    currentFrameDateTimeParts
  ) => {
    if (selectedSubject === null) {
      return null
    }
    if (!behaviourInfo) {
      throw new Error("No BehaviourInfo");
    }
    const parts: string[] = behaviourInfo.layout.map(({type}) => {
      if (type === "frameNumber") {
        return `${currentFrameNumber}`
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


