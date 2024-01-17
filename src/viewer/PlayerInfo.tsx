import { FunctionComponent } from "react";
import * as viewercss from "./viewer.module.css"
import * as css from "./playerinfo.module.css"
import { Icon, ValidIconName } from "src/lib/Icon";
import { useSelector } from "react-redux";
import { selectPlayerState, PLAYBACK_RATES,
  videoPlay,
  videoPause,
  videoTogglePlayPause,
  videoSeekToFrameNumberAndPause,
  videoSeekToFrameNumberDiffAndPause,
  videoChangePlaybackRateOneStep,
  videoSeekToNextDetectionAndPause,
  selectPlaybackRate,
  selectCurrentFrameNumber,
} from "./videoPlayerSlice";
import { AppDispatch, useAppDispatch } from "./store"
import { RootState } from "./store.js"
import { joinedStringFromDict } from "src/lib/util";
import { selectCurrentFrameDateTime, selectDetectionInfo } from "./detectionsSlice";
import { keyShortcutHelpScreenToggled, selectShowKeyShortcutHelp } from "./appSlice";
import { behaviourInfoLineRemoved, currentlySelectedLineUpdated, selectBehaviourInfo, selectSelectedBehaviourLine } from "./behaviourSlice";

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

export const CONTROL_INFO_S = {
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
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep(false)))},
    selectIsDisabled: state => selectPlaybackRate(state) === PLAYBACK_RATES.at(-1)!,
    description: "Increase playback speed"
  }),
  speed_down: fillAndWrapDefaultControlInfo({
    iconName: "speed",
    subIconName: "north_west",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep(true)))},
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
    selectIsDisabled: state => selectDetectionInfo(state) === null,
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause(false)))},
    description: "Next frame with detection"
  }),
  previous_frame_with_detection: fillAndWrapDefaultControlInfo({
    iconName: "skip_previous",
    selectIsDisabled: state => selectDetectionInfo(state) === null,
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause(true)))},
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
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!
    }),
    action: (dispatch, {behaviourInfo, selectedBehaviourLine}) => {
      const newLine = Math.max(1, selectedBehaviourLine.index - (
        selectedBehaviourLine.rel === "at" ? 1 : 0))
      dispatch(currentlySelectedLineUpdated(newLine))
      const frameNumberIndex = behaviourInfo.layout.findIndex(
      ({type}) => type === "frameNumber")
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
      selectedBehaviourLine: selectSelectedBehaviourLine(state)!
    }),
    action: (dispatch, {behaviourInfo, selectedBehaviourLine}) => {
      const newLine = Math.min(
        behaviourInfo.lines.length - 1, selectedBehaviourLine.index + 1)
      dispatch(currentlySelectedLineUpdated(newLine))
      const frameNumberIndex = behaviourInfo.layout.findIndex(
      ({type}) => type === "frameNumber")
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
  })
} as const

export function Button<T>(
  {controlInfo}: {controlInfo: ControlInfo<T>}
) {
  const dispatch = useAppDispatch()
  const disabled = useSelector(controlInfo.selectIsDisabled)
  const activated = useSelector(controlInfo.selectIsActivated)
  const actionArgument: T = useSelector(
    // this allows us to use selectors that would error when disabled = true
    disabled ? (() => undefined as T): controlInfo.selectActionArgument)


  return <button
    disabled={disabled}
    title={controlInfo.description}
    className={joinedStringFromDict({
      [css.activated]: activated,
      [css.control]: true,
    })} onClick={() => {if (!disabled) {
      controlInfo.action(dispatch, actionArgument)}}}>
    <Icon iconName={controlInfo.iconName} />
    {controlInfo.subIconName && <div className={
      [css.subIcon, css.topRight].join(" ")}>
      <Icon iconName={controlInfo.subIconName} />
    </div>}
  </button>
}

const PlayerInfoDetails: FunctionComponent = () => {
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const currentDateTime = useSelector(selectCurrentFrameDateTime)

  return <div>
    <div>Framenumber: {currentFrameNumber}</div>
    {currentDateTime && 
    <div>
        Timestamp: <div>
          {currentDateTime.day}-{currentDateTime.month}-{currentDateTime.year} {currentDateTime.hour}:{currentDateTime.minute}:{currentDateTime.second}
          </div>
      </div>}
  </div>
}

export const PlayerInfo: FunctionComponent = () => {
  const playerState = useSelector(selectPlayerState)


  const playControl: ControlInfo<unknown> = (
    !playerState ? CONTROL_INFO_S.play_pause
      : playerState.ended ? CONTROL_INFO_S.restart
        : playerState.paused ? CONTROL_INFO_S.play
          : CONTROL_INFO_S.pause
  )

  return <div className={viewercss.playerinfo}>
    <div>
      {playerState && <PlayerInfoDetails />}
    </div>
    <div className={css.controls}>
      <Button controlInfo={CONTROL_INFO_S.previous_behaviour_line} />
      <Button controlInfo={CONTROL_INFO_S.delete_selected_behaviour_line} />
      <Button controlInfo={CONTROL_INFO_S.next_behaviour_line} />
      <Button controlInfo={CONTROL_INFO_S.previous_frame_with_detection} />
      <button disabled />
      <Button controlInfo={CONTROL_INFO_S.next_frame_with_detection} />
      <Button controlInfo={CONTROL_INFO_S.previous_frame} />
      <Button controlInfo={playControl} />
      <Button controlInfo={CONTROL_INFO_S.next_frame} />
      <Button controlInfo={CONTROL_INFO_S.speed_down} />
      <button disabled />
      <Button controlInfo={CONTROL_INFO_S.speed_up} />
      <div />
      <div />
      <Button controlInfo={CONTROL_INFO_S.key_shortcut_help_toggle} />
    </div>
  </div>
}
