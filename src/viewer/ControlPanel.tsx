import { FunctionComponent } from "preact";
import * as viewercss from "./viewer.module.css"
import * as css from "./controlpanel.module.css"
import { useSelector } from "react-redux";
import { selectPlaybackRate, selectPlayerState } from "./videoPlayerSlice";
import { selectCurrentFrameDateTime, selectCurrentFrameNumber} from "./selectors";
import { CONTROLS } from "./controls";
import { Button } from "./Button";
import { formatDateTimeParts } from "../lib/detections";


const ControlPanelDetails: FunctionComponent = () => {
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const currentDateTime = useSelector(selectCurrentFrameDateTime)

  return <div>
    <div>Framenumber: {currentFrameNumber}</div>
    {currentDateTime && 
    <div>
        Timestamp: <div>
          {formatDateTimeParts(currentDateTime, "%Y-%m-%d %H:%M:%S")}
        </div>
      </div>}
  </div>
}

export const ControlPanel: FunctionComponent = () => {
  const playerState = useSelector(selectPlayerState)
  const playbackSpeed = useSelector(selectPlaybackRate)


  return <div className={viewercss.controlpanel}>
    <div>
      {playerState && <ControlPanelDetails />}
    </div>
    <div className={css.controls}>
      <Button controlInfo={CONTROLS.previous_behaviour_line} />
      <Button controlInfo={CONTROLS.delete_selected_behaviour_line} />
      <Button controlInfo={CONTROLS.next_behaviour_line} />
      <Button controlInfo={CONTROLS.previous_frame_with_detection} />
      <Button controlInfo={CONTROLS.hide_detection_boxes} />
      <Button controlInfo={CONTROLS.next_frame_with_detection} />
      <Button controlInfo={CONTROLS.previous_frame} />
      <Button controlInfo={CONTROLS.play_pause} />
      <Button controlInfo={CONTROLS.next_frame} />
      <Button controlInfo={CONTROLS.speed_down} />
      <div className={css.playback_speed}>{
        playbackSpeed !== null && (playbackSpeed.toFixed(2) + "x")}</div>
      <Button controlInfo={CONTROLS.speed_up} />
      <Button controlInfo={CONTROLS.edit_comment_for_current_line} />
      <Button controlInfo={CONTROLS.zoom_toggle} />
      <Button controlInfo={CONTROLS.key_shortcut_help_toggle} />
    </div>
  </div>
}
