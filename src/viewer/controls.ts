import {
  videoPlay,
  videoPause,
  videoTogglePlayPause,
  videoSeekToFrameNumberAndPause,
  videoSeekToFrameNumberDiffAndPause,
  videoChangePlaybackRateOneStep,
  videoSeekToNextDetectionAndPause,
} from "./videoPlayerActions"
import { ValidIconName } from "../lib/Icon";
import { selectPlayerState, PLAYBACK_RATES, selectPlaybackRate, } from "./videoPlayerSlice";
import { AppDispatch, RootState } from "./store"
import { selectDetectionInfoPotentiallyNull } from "./detectionsSlice";
import { keyShortcutHelpScreenToggled, selectSelectedSubject, selectShowKeyShortcutHelp } from "./appSlice";
import { behaviourInfoLineRemoved, currentlyEditingFieldIndexSet, currentlySelectedLineUpdated, selectBehaviourInfo} from "./behaviourSlice";
import { selectSelectedBehaviourLine } from "./selectors";
import { selectFramenumberIndexInLayout } from "./settingsSlice";

export type ControlInfo<T> = {
  iconName: ValidIconName
  subIconName?: ValidIconName
  selectIsDisabled: (state: RootState) => boolean,
  selectIsActivated: (state: RootState) => boolean,
  selectActionArgument: (state: RootState) => T,
  action: (dispatch: AppDispatch, actionArgument: T) => void
  description: string,
}

type OptionalControlInfoKeys = "selectIsDisabled" | "selectIsActivated" | "selectActionArgument"

function fillAndWrapDefaultControlInfo<T>(
info: Partial<ControlInfo<T>> & Omit<ControlInfo<T>, OptionalControlInfoKeys>,
): ControlInfo<T> {
  return {
    ...info,
    selectIsActivated: state => selectPlayerState(state) !== null
      && (info.selectIsActivated ?? (() => false))(state),
    selectIsDisabled: state => selectPlayerState(state) === null
      || (info.selectIsDisabled ?? (() => false))(state),
    selectActionArgument: state => (
      info.selectActionArgument ?? (() => undefined as T))(state),
  }
}



export const CONTROLS = {
  play: fillAndWrapDefaultControlInfo({
    iconName: "resume",
    action: dispatch => {void(dispatch(videoPlay()))},
    description: "Start or resume play. If already playing, do nothing"
  }),
  pause: fillAndWrapDefaultControlInfo({
    iconName: "pause",
    action: dispatch => {void(dispatch(videoPause()))},
    description: "Pause play. If already paused, do nothing"
  }),
  play_pause: fillAndWrapDefaultControlInfo({
    iconName: "play_pause",
    action: dispatch => {void(dispatch(videoTogglePlayPause()))},
    description: "Pause if playing, start playing if paused",
  }),
  speed_up: fillAndWrapDefaultControlInfo({
    iconName: "speed",
    subIconName: "south_east",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep("faster")))},
    selectIsDisabled: state => selectPlaybackRate(state) === PLAYBACK_RATES.at(-1)!,
    description: "Increase playback speed"
  }),
  speed_down: fillAndWrapDefaultControlInfo({
    iconName: "speed",
    subIconName: "north_west",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep("slower")))},
    selectIsDisabled: state => selectPlaybackRate(state) === PLAYBACK_RATES.at(0)!,
    description: "Decrease playback speed"
  }),
  next_frame: fillAndWrapDefaultControlInfo({
    iconName: "navigate_next",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberDiffAndPause(1)))},
    description: "Next frame"
  }),
  previous_frame: fillAndWrapDefaultControlInfo({
    iconName: "navigate_before",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberDiffAndPause(-1)))},
    description: "Previous frame"
  }),
  next_frame_with_detection: fillAndWrapDefaultControlInfo({
    iconName: "skip_next",
    selectIsDisabled: state => selectDetectionInfoPotentiallyNull(state) === null,
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause("forwards")))},
    description: "Next frame with detection"
  }),
  previous_frame_with_detection: fillAndWrapDefaultControlInfo({
    iconName: "skip_previous",
    selectIsDisabled: state => selectDetectionInfoPotentiallyNull(state) === null,
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause("backwards")))},
    description: "Previous frame with detection"
  }),
  restart: fillAndWrapDefaultControlInfo({
    iconName: "restart_alt",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberAndPause(0)))},
    description: "Restart video"
  }),
  key_shortcut_help_toggle: {
    iconName: "indeterminate_question_box",
    selectIsDisabled: () => false,
    selectIsActivated: state => selectShowKeyShortcutHelp(state),
    selectActionArgument: () => undefined,
    action: dispatch => dispatch(keyShortcutHelpScreenToggled()),
    description: "Show/hide the shortcut key help overlay"
  } as ControlInfo<undefined>,
  previous_behaviour_line: fillAndWrapDefaultControlInfo({
    iconName: "vertical_align_top",
    description: "previous behaviour line",
    selectIsDisabled: state => {
      const behaviourInfo = selectBehaviourInfo(state)
      if (!behaviourInfo) return true
      const selectedBehaviourLine = selectSelectedBehaviourLine(state)!
      return (selectedBehaviourLine.index === 1 && selectedBehaviourLine.rel === "at") || selectedBehaviourLine.index === 0
    },
    selectActionArgument: state => ({
      behaviourInfo: selectBehaviourInfo(state)!,
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!,
      frameNumberIndex: selectFramenumberIndexInLayout(state),
    }),
    action: (dispatch, {behaviourInfo, selectedBehaviourLine, frameNumberIndex}) => {
      const newLine = Math.max(1, selectedBehaviourLine.index - (
        selectedBehaviourLine.rel === "at" ? 1 : 0))
      dispatch(currentlySelectedLineUpdated(newLine))
      const newFrameNumber = parseInt(
        (behaviourInfo.lines[newLine] ?? [])[frameNumberIndex])
      if (!isNaN(newFrameNumber)) {
        void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
      }
    }
  }),
  next_behaviour_line: fillAndWrapDefaultControlInfo({
    iconName: "vertical_align_bottom",
    description: "next behaviour line",
    selectIsDisabled: state => {
      const behaviourInfo = selectBehaviourInfo(state)
      if (!behaviourInfo) return true
      const selectedBehaviourLine = selectSelectedBehaviourLine(state)!
      return selectedBehaviourLine.index === behaviourInfo.lines.length - 1
    },
    selectActionArgument: state => ({
      behaviourInfo: selectBehaviourInfo(state)!,
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!,
      frameNumberIndex: selectFramenumberIndexInLayout(state),
    }),
    action: (dispatch, {behaviourInfo, selectedBehaviourLine, frameNumberIndex}) => {
      const newLine = Math.min(
        behaviourInfo.lines.length - 1, selectedBehaviourLine.index + 1)
      dispatch(currentlySelectedLineUpdated(newLine))
      const newFrameNumber = parseInt(
        (behaviourInfo.lines[newLine] ?? [])[frameNumberIndex])
      if (!isNaN(newFrameNumber)) {
        void(dispatch(videoSeekToFrameNumberAndPause(newFrameNumber)))
      }
    }
  }),
  delete_selected_behaviour_line: fillAndWrapDefaultControlInfo({
    iconName: "disabled_by_default",
    description: "remove the selected behaviour line",
    selectIsDisabled: state => {
      const behaviourInfo = selectBehaviourInfo(state)
      if (!behaviourInfo) return true
      const selectedBehaviourLine = selectSelectedBehaviourLine(state)!
      return selectedBehaviourLine.rel !== "at"
    },
    selectActionArgument: state => ({
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!
    }),
    action: (dispatch, {selectedBehaviourLine}) => {
      if (selectedBehaviourLine.rel !== "at") {
        throw new Error("Should be 'at'")
      }
      dispatch(behaviourInfoLineRemoved(selectedBehaviourLine.index))
    }
  }),
  edit_comment_for_current_line: fillAndWrapDefaultControlInfo({
    iconName: "feedback",
    description: "edit comment for the current behaviour line",
    selectIsDisabled: state => {
      const line = selectSelectedBehaviourLine(state)
      const behaviourInfo = selectBehaviourInfo(state)
      const subjectSelected = selectSelectedSubject(state)
      return (
        !!subjectSelected
        || !behaviourInfo
        || behaviourInfo.currentlyEditingFieldIndex !== null
        || behaviourInfo.layout.findIndex(
            col => col.type.startsWith("comments:")) === -1
        || !line
        || line.rel !== "at"
      )
    },
    selectActionArgument: state => ({
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!,
      behaviourInfo: selectBehaviourInfo(state)!,
    }),
    action: (dispatch, {selectedBehaviourLine, behaviourInfo}) => {
      dispatch(currentlyEditingFieldIndexSet({
        currentlySelectedLine: selectedBehaviourLine.index,
        currentlyEditingFieldIndex: behaviourInfo.layout.findIndex(
            col => col.type.startsWith("comments:"))
      }))
    }
  })
} as const

export type ValidControlName = keyof typeof CONTROLS
