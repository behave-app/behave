import { createSelector } from "@reduxjs/toolkit";
import { selectSelectedSubject, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, selectIsWaitingForVideoShortcut } from './appSlice';
import { selectBehaviourInfo } from "./behaviourSlice";
import { selectDateTimes, selectDetectionInfoPotentiallyNull, selectFps, selectOffset } from "./detectionsSlice";
import { BehaviourShortcutItem, SubjectShortcutItem, VideoShortcutItem, selectBehaviourShortcutMap, selectConfidenceCutoff, selectFramenumberIndexInLayout, selectSubjectShortcutMap, selectVideoShortcutMap } from './settingsSlice';
import type { RootState } from './store';
import { selectCurrentTime } from "./videoPlayerSlice";

export const selectActiveShortcuts = createSelector(
  [selectIsWaitingForVideoShortcut, selectIsWaitingForSubjectShortcut,
  selectIsWaitingForBehaviourShortcut, selectVideoShortcutMap,
  selectSubjectShortcutMap, selectBehaviourShortcutMap],
  (doVideo, doSubject, doBehaviour,
  videoShortcuts, subjectShortcuts, behaviourSubjects) => {
    return new Map<string, VideoShortcutItem | SubjectShortcutItem | BehaviourShortcutItem>([
      ...(doVideo ? videoShortcuts.entries() : []) as [string, VideoShortcutItem][],
      ...(doSubject ? subjectShortcuts.entries() : [] as [string, SubjectShortcutItem][]),
      ...(doBehaviour ? behaviourSubjects.entries() : [] as [string, BehaviourShortcutItem][]),
      ])
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
  [selectCurrentFrameNumber, selectDetectionInfoPotentiallyNull, selectConfidenceCutoff],
  (currentFrameNumber, detectionInfo, confidenceCutoff) => {
    if (!detectionInfo || currentFrameNumber === null) {
      return null
    }
    return detectionInfo.framesInfo[currentFrameNumber].detections
      .filter(d => d.confidence >= confidenceCutoff)
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
    selectSelectedSubject, selectBehaviourInfo, selectCurrentFrameNumber,
    selectCurrentFrameInfoPotentiallyNull, selectCurrentFrameDateTime
  ],
  (
    selectedSubject, behaviourInfo, currentFrameNumber,
    currentFrameInfo, currentFrameDateTimeParts
  ) => {
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

