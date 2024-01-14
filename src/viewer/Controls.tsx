import { FunctionComponent } from "react";
import * as viewercss from "./viewer.module.css"
import * as css from "./controls.module.css"
import { Icon, ValidIconName } from "src/lib/Icon";
import { useSelector } from "react-redux";
import { selectPlayerState, PlayerState, PLAYBACK_RATES,
  videoPlay,
  videoPause,
  videoTogglePlayPause,
  videoSeekToFrameNumberDiffAndPause,
  videoChangePlaybackRateOneStep,
  videoSeekToNextDetectionAndPause,
  selectPlaybackRate,
} from "./videoPlayerSlice";
import { AppDispatch, useAppDispatch } from "./store"
import { RootState } from "./store.js"

type Action = {
  iconName: ValidIconName
  isActive?: (state: RootState) => boolean,
  isAvailble?: (state: RootState) => boolean,
  action: (dispatch: AppDispatch) => void
  description: string,
}

export const ACTIONS: Record<string, Action> = {
  play: {
    iconName: "resume",
    action: dispatch => {void(dispatch(videoPlay()))},
    description: "Start or resume play. If already playing, do nothing"
  },
  pause: {
    iconName: "pause",
    action: dispatch => {void(dispatch(videoPause()))},
    description: "Start or resume play. If already playing, do nothing"
  },
  play_pause: {
    iconName: "play_pause",
    action: dispatch => {void(dispatch(videoTogglePlayPause))},
    description: "Pause if playing, start playing if paused",
  },
  speed_up: {
    iconName: "fast_forward",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep(false)))},
    isActive: state => selectPlaybackRate(state) < PLAYBACK_RATES.at(-1)!,
    description: "Increase playback speed"
  },
  speed_down: {
    iconName: "play_arrow",
    action: dispatch => {void(dispatch(videoChangePlaybackRateOneStep(true)))},
    isActive: state => selectPlaybackRate(state) > PLAYBACK_RATES.at(0)!,
    description: "Decrease playback speed"
  },
  next_frame: {
    iconName: "next",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberDiffAndPause(1)))},
    description: "Next frame"
  },
  previous_frame: {
    iconName: "previous",
    action: dispatch => {void(dispatch(videoSeekToFrameNumberDiffAndPause(-1)))},
    description: "Previous frame"
  },
  next_frame_with_detection: {
    iconName: "skip_next",
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause(false)))},
    description: "Next frame with detection"
  },
  previous_frame_with_detection: {
    iconName: "skip_previous",
    action: dispatch => {void(dispatch(videoSeekToNextDetectionAndPause(true)))},
    description: "Previous frame with detection"},
} as const

const Button: FunctionComponent<{action: Action}> = ({action}) => {
  const dispatch = useAppDispatch()
  return <button onClick={() => action.action(dispatch)}>
    <Icon iconName={action.iconName} />
  </button>
}


export const Controls: FunctionComponent = () => {
  const playerState = useSelector(selectPlayerState)


  const playButton: ValidIconName = !playerState ? "play_pause" 
  : playerState.ended ? "restart"
  : playerState.paused ? "resume" : "pause"

  return <div className={viewercss.controls}>
    <div className={css.controls}>
      <Button action={ACTIONS.previous_frame_with_detection} />
      <Button action={ACTIONS.play} />
      <Button action={ACTIONS.next_frame_with_detection} />
      <Button action={ACTIONS.previous_frame} />
      <Button action={ACTIONS.play} />
      <Button action={ACTIONS.next_frame} />
      <Button action={ACTIONS.speed_down} />
      <Button action={ACTIONS.play} />
      <Button action={ACTIONS.speed_up} />
    </div>
  </div>
}
