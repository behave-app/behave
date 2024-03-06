import { FunctionComponent } from "preact";
import * as viewercss from "./viewer.module.css"
import * as css from "./controlpanel.module.css"
import { useSelector } from "react-redux";
import { selectPlaybackRate, selectPlayerState } from "./videoPlayerSlice";
import { selectCurrentFrameDateTime, selectCurrentFrameNumber} from "./selectors";
import { CONTROLS } from "./controls";
import { Button } from "./Button";
import { formatDateTimeParts } from "../lib/detections";
import { selectZoomLevel } from "./appSlice";


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
  const zoomLevel = useSelector(selectZoomLevel)


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
        playbackSpeed !== null && ((playbackSpeed * 100).toFixed(0) + "%")}</div>
      <Button controlInfo={CONTROLS.speed_up} />
      <Button controlInfo={CONTROLS.zoom_out} />
      <div className={css.zoom_level}>{zoomLevel.toFixed(1)}x</div>
      <Button controlInfo={CONTROLS.zoom_in} />
      <Button controlInfo={CONTROLS.edit_comment_for_current_line} />
      <div />
      <Button controlInfo={CONTROLS.key_shortcut_help_toggle} />
    </div>
  </div>
}
