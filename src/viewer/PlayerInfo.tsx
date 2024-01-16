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

type ControlInfo = {
  iconName: ValidIconName
  subIconName?: ValidIconName
  selectIsDisabled?: (state: RootState) => boolean,
  selectIsActivated?: (state: RootState) => boolean,
  action: (dispatch: AppDispatch) => void
  description: string,
}

export const CONTROL_INFO_S = {
  play: {
    iconName: "resume",
    action: dispatch => {void(dispatch(videoPlay()))},
    description: "Start or resume play. If already playing, do nothing"
  } as ControlInfo,
  pause: {
    iconName: "pause",
    action: dispatch => {void(dispatch(videoPause()))},
    description: "Start or resume play. If already playing, do nothing"
  } as ControlInfo,
  play_pause: {
    iconName: "play_pause",
    action: dispatch => {void(dispatch(videoTogglePlayPause))},
    description: "Pause if playing, start playing if paused",
  } as ControlInfo,
  speed_up: {
    iconName: "speed",
    subIconName: "south_east",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep(false)))},
    selectIsDisabled: state => selectPlaybackRate(state) === PLAYBACK_RATES.at(-1)!,
    description: "Increase playback speed"
  } as ControlInfo,
  speed_down: {
    iconName: "speed",
    subIconName: "north_west",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep(true)))},
    selectIsDisabled: state => selectPlaybackRate(state) === PLAYBACK_RATES.at(0)!,
    description: "Decrease playback speed"
  } as ControlInfo,
  next_frame: {
    iconName: "navigate_next",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberDiffAndPause(1)))},
    description: "Next frame"
  } as ControlInfo,
  previous_frame: {
    iconName: "navigate_before",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberDiffAndPause(-1)))},
    description: "Previous frame"
  } as ControlInfo,
  next_frame_with_detection: {
    iconName: "skip_next",
    selectIsDisabled: state => selectDetectionInfo(state) === null,
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause(false)))},
    description: "Next frame with detection"
  } as ControlInfo,
  previous_frame_with_detection: {
    iconName: "skip_previous",
    selectIsDisabled: state => selectDetectionInfo(state) === null,
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause(true)))},
    description: "Previous frame with detection"
  } as ControlInfo,
  restart: {
    iconName: "restart_alt",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberAndPause(0)))},
    description: "Restart video"
  } as ControlInfo,
} as const

const makeSelector = (
  selector: undefined | ((state: RootState) => boolean),
  stateIfNoPlayerState: boolean,
): ((state: RootState) => boolean) => {
  return state => {
    if (!state.videoPlayer.playerState) {
      return stateIfNoPlayerState
    }
    if (!selector) {
      return false
    }
    return selector(state)
  }
}

const Button: FunctionComponent<{controlInfo: ControlInfo}> = ({controlInfo: action}) => {
  const dispatch = useAppDispatch()
  const disabled = useSelector(makeSelector(action.selectIsDisabled, true))
  const activated = useSelector(makeSelector(action.selectIsActivated, false))


  return <button
    disabled={disabled}
    className={joinedStringFromDict({
      [css.activated]: activated
    })} onClick={() => {if (!disabled) {action.action(dispatch)}}}>
    <Icon iconName={action.iconName} />
    {action.subIconName && <div className={[css.subIcon, css.topRight].join(" ")}>
      <Icon iconName={action.subIconName} />
    </div>}
  </button>
}

const PlayerInfoDetails: FunctionComponent = () => {
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const currentDateTime = useSelector(selectCurrentFrameDateTime)

  return <div>
    <div>Framenumber: {currentFrameNumber}</div>
    <div>Timestamp: {currentDateTime?.date.toISOString()}</div>
  </div>
}

export const PlayerInfo: FunctionComponent = () => {
  const playerState = useSelector(selectPlayerState)


  const playControl: ControlInfo = (
    !playerState ? CONTROL_INFO_S.play_pause
      : playerState.ended ? CONTROL_INFO_S.restart
        : playerState.paused ? CONTROL_INFO_S.play
          : CONTROL_INFO_S.pause
  )

  return <div className={viewercss.playerinfo}>
    {playerState && <PlayerInfoDetails />}
    <div className={css.controls}>
      <Button controlInfo={CONTROL_INFO_S.previous_frame_with_detection} />
      <Button controlInfo={CONTROL_INFO_S.play} />
      <Button controlInfo={CONTROL_INFO_S.next_frame_with_detection} />
      <Button controlInfo={CONTROL_INFO_S.previous_frame} />
      <Button controlInfo={playControl} />
      <Button controlInfo={CONTROL_INFO_S.next_frame} />
      <Button controlInfo={CONTROL_INFO_S.speed_down} />
      <Button controlInfo={CONTROL_INFO_S.play} />
      <Button controlInfo={CONTROL_INFO_S.speed_up} />
    </div>
  </div>
}
