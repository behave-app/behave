import { createSelector } from "@reduxjs/toolkit";
import { selectBehaviourInfo, selectCurrentlySelectedSubject } from "./behaviourSlice";
import { selectDetectionInfoPotentiallyNull, selectFps, selectOffset } from "./detectionsSlice";
import { SettingsForDetectionClass, getKeyFromModelKlasses, selectFramenumberIndexInLayout, selectSettingsByDetectionClassByKey, selectTimeOffsetSeconds } from './generalSettingsSlice';
import type { RootState } from './store';
import { selectCurrentTime } from "./videoPlayerSlice";
import { HSL } from "../lib/colour";
import { ObjectEntries } from "../lib/util";
import { getPartsFromTimestamp } from "../lib/detections";


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
  [selectCurrentTime, selectFps, selectOffset],
  (currentTime, fps, offset) => {
    if (currentTime === null
      || !Number.isFinite(currentTime)
      || !Number.isFinite(fps)
      || !Number.isFinite(offset)) {
      return null
    }
    return Math.round(currentTime! * fps) + offset
  }
)
export const selectDateTimes = createSelector(
  [selectDetectionInfoPotentiallyNull, selectTimeOffsetSeconds],
  (detectionInfo, offsetSeconds): null | ReturnType<typeof getPartsFromTimestamp>[] => {
    if (!detectionInfo) {
      return null
    }
    const frameInfosWithTs = detectionInfo.framesInfo
    .filter(frameInfo => "timestamp" in frameInfo)
    .map(frameInfo => ({
      ...frameInfo,
      timestampParts: getPartsFromTimestamp(frameInfo.timestamp!)
    }))
    if (frameInfosWithTs.length < 2) {
      console.warn("too few timestamps")
      return null
    }
    if (new Set(frameInfosWithTs
      .map(fi => fi.timestampParts.tz)).size !== 1) {
      console.warn("Not all items have same TZ")
      return null
    }
    let index = 0
    const p2 = (n: number) => n.toString().padStart(2, "0")
    const p4 = (n: number) => n.toString().padStart(4, "0")
    const calculateTimestamp = (pts: number): ReturnType<typeof getPartsFromTimestamp> => {
      const [start, end] = frameInfosWithTs.slice(index, index + 2)
      const pos = (pts - start.pts) / (end.pts - start.pts)
      if (pos > 1 && frameInfosWithTs.length > index + 2) {
        index++
        return calculateTimestamp(pts)
      }
      const ts = Math.round(
        (start.timestampParts.date.valueOf() + pos * (
          end.timestampParts.date.valueOf() - start.timestampParts.date.valueOf()
        )) / 1000) * 1000 + start.timestampParts.tzOffsetHours * 60 * 60 * 1000
        + offsetSeconds * 1000
      const date = new Date(ts)
      return {
        date,
        year: p4(date.getUTCFullYear()),
        month: p2(date.getUTCMonth() + 1),
        day: p2(date.getUTCDate()),
        hour: p2(date.getUTCHours()),
        minute: p2(date.getUTCMinutes()),
        second: p2(date.getUTCSeconds()),
        tz: start.timestampParts.tz,
        tzOffsetHours: start.timestampParts.tzOffsetHours,
      }
    }
    return detectionInfo.framesInfo.map(
      frameInfo => calculateTimestamp(frameInfo.pts))
  }
)


export const selectCurrentFrameDateTime = createSelector(
  [selectCurrentFrameNumber, selectDateTimes],
  (currentFrameNumber, datetimes) => {
    if (!datetimes || currentFrameNumber === null) {
      return null
    }
    return datetimes[currentFrameNumber]
  }
)

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
    selectCurrentFrameInfoPotentiallyNull, selectCurrentFrameDateTime
  ],
  (
    selectedSubject, behaviourInfo, currentFrameNumber,
    currentFrameInfo, currentFrameDateTimeParts
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


