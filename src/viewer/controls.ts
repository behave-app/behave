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
import { SidebarPopup, hideDetectionBoxesToggled, selectHideDetectionBoxes, selectSidebarPopup, selectZoom, sidebarPopupWasToggled, zoomToggled } from "./appSlice";
import { currentlySelectedLineUpdated, removeBehaviourInfoLine, selectBehaviourInfo, selectCurrentlySelectedSubject, setCurrentlyEditingFieldIndex} from "./behaviourSlice";
import { selectSelectedBehaviourLine } from "./selectors";
import { selectFramenumberIndexInLayout, selectControlPanelShown, controlPaneToggled, selectBehaviourBarShown, behaviourBarToggled, detectionBarToggled, selectDetectionBarShown } from "./generalSettingsSlice";

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
    selectIsActivated: () => false,
    selectIsDisabled: (state: RootState) => selectPlayerState(state) === null,
    selectActionArgument: (state: RootState) => (
      info.selectActionArgument ?? (() => undefined as T))(state),
    ...info,
  }
}

function createPopupControl<T>(props: {
  iconName: ValidIconName,
  name?: string,
  popupName: SidebarPopup,
  } & Partial<ControlInfo<T>>) {
  const {name, popupName, ...rest} = props

  return fillAndWrapDefaultControlInfo({
    description: `Show ${name ?? popupName} popup`,
    action: dispatch => {
      void(dispatch(videoPause()))
      dispatch(sidebarPopupWasToggled(popupName))
    },
    selectIsActivated: state => selectSidebarPopup(state) === popupName,
    selectIsDisabled: () => false,
    ...rest
})
}

export const CONTROLS = {
  show_info: createPopupControl({
    iconName: "info",
    popupName: "info"
  }),

  class_sliders: createPopupControl({
    iconName: "sliders",
    popupName: "classSliders",
    selectIsDisabled: state => !selectDetectionInfoPotentiallyNull(state),
    name: "settings for detections",
  }),

  upload_files: createPopupControl({
    iconName: "upload_file",
    popupName: "uploader",
    name: "Upload files and start a new detection",
  }),

  sizer: createPopupControl({
    iconName: "height",
    popupName: "sizer",
    name: "Set the sizes of different elements",
  }),

  key_shortcut_help_toggle: createPopupControl({
    iconName: "indeterminate_question_box",
    name: "key shortcuts help and customization",
    popupName: "keyShortcuts",
  }),

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
    selectIsActivated: state => !state.videoPlayer.playerState?.paused,
    description: "Pause if playing, start playing if paused",
  }),

  speed_up: fillAndWrapDefaultControlInfo({
    iconName: "speed",
    subIconName: "south_east",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep("faster")))},
    selectIsDisabled: state => selectPlayerState(state) === null || selectPlaybackRate(state) === PLAYBACK_RATES.at(-1)!,
    description: "Increase playback speed"
  }),

  speed_down: fillAndWrapDefaultControlInfo({
    iconName: "speed",
    subIconName: "north_west",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep("slower")))},
    selectIsDisabled: state => selectPlayerState(state) === null || selectPlaybackRate(state) === PLAYBACK_RATES.at(0)!,
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

  hide_detection_boxes: fillAndWrapDefaultControlInfo({
    iconName: "remove_selection",
    description: "Hide detection boxes",
    selectIsDisabled: state => selectDetectionInfoPotentiallyNull(state) === null,
    selectIsActivated: state => selectHideDetectionBoxes(state),
    action: dispatch => {dispatch(hideDetectionBoxesToggled())},
  }),

  restart: fillAndWrapDefaultControlInfo({
    iconName: "restart_alt",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberAndPause(0)))},
    description: "Restart video"
  }),

  previous_behaviour_line: fillAndWrapDefaultControlInfo({
    iconName: "vertical_align_top",
    description: "previous behaviour line",
    selectIsDisabled: state => {
      const selectedBehaviourLine = selectSelectedBehaviourLine(state)
      if (!selectedBehaviourLine) return true
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
      const selectedBehaviourLine = selectSelectedBehaviourLine(state)
      if (!behaviourInfo || !selectedBehaviourLine) {
        return true
      }
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
    iconName: "delete",
    description: "remove the selected behaviour line",
    selectIsDisabled: state => {
      const selectedBehaviourLine = selectSelectedBehaviourLine(state)
      if (!selectedBehaviourLine) {
        return true
      }
      return selectedBehaviourLine.rel !== "at"
    },
    selectActionArgument: state => ({
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!
    }),
    action: (dispatch, {selectedBehaviourLine}) => {
      if (selectedBehaviourLine.rel !== "at") {
        throw new Error("Should be 'at'")
      }
      void(dispatch(removeBehaviourInfoLine(selectedBehaviourLine.index)))
    }
  }),

  edit_comment_for_current_line: fillAndWrapDefaultControlInfo({
    iconName: "feedback",
    description: "edit comment for the current behaviour line",
    selectIsDisabled: state => {
      const line = selectSelectedBehaviourLine(state)
      const behaviourInfo = selectBehaviourInfo(state)
      const subjectSelected = selectCurrentlySelectedSubject(state)
      return (
        subjectSelected !== null
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
      void(dispatch(setCurrentlyEditingFieldIndex({
        currentlySelectedLine: selectedBehaviourLine.index,
        currentlyEditingFieldIndex: behaviourInfo.layout.findIndex(
            col => col.type.startsWith("comments:"))
      })))
    }
  }),

  show_controls: fillAndWrapDefaultControlInfo({
    iconName: "remote_gen",
    description: "Toggle whether controls and info is shown next to the player",
    selectIsDisabled: () => false,
    selectIsActivated: state => selectControlPanelShown(state),
    action: dispatch => dispatch(controlPaneToggled())
  }),

  show_detection_bar: fillAndWrapDefaultControlInfo({
    iconName: "bar_chart_4_bars",
    description: "Toggle whether detection bar is shown",
    selectIsDisabled: () => false,
    selectIsActivated: state => selectDetectionBarShown(state),
    action: dispatch => dispatch(detectionBarToggled())
  }),


  show_behaviour_bar: fillAndWrapDefaultControlInfo({
    iconName: "data_table",
    description: "Toggle whether behaviour bar is shown",
    selectIsDisabled: () => false,
    selectIsActivated: state => selectBehaviourBarShown(state),
    action: dispatch => dispatch(behaviourBarToggled())
  }),

  zoom_toggle: fillAndWrapDefaultControlInfo({
    iconName: "zoom_in",
    description: "Toggle zoom follow mouse",
    selectIsActivated: state => selectZoom(state) > 1,
    action: dispatch => dispatch(zoomToggled()),
  }),
} as const

export type ValidControlName = keyof typeof CONTROLS
