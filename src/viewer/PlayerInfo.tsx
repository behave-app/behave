import { FunctionComponent } from "preact";
import * as viewercss from "./viewer.module.css"
import * as css from "./playerinfo.module.css"
import { useSelector } from "react-redux";
import { selectPlayerState } from "./videoPlayerSlice";
import { selectCurrentFrameDateTime, selectCurrentFrameNumber} from "./selectors";
import { ControlInfo, CONTROLS } from "./controls";
import { Button } from "./Button";


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
    !playerState ? CONTROLS.play_pause
      : playerState.ended ? CONTROLS.restart
        : playerState.paused ? CONTROLS.play
          : CONTROLS.pause
  )

  return <div className={viewercss.playerinfo}>
    <div>
      {playerState && <PlayerInfoDetails />}
    </div>
    <div className={css.controls}>
      <Button controlInfo={CONTROLS.previous_behaviour_line} />
      <Button controlInfo={CONTROLS.delete_selected_behaviour_line} />
      <Button controlInfo={CONTROLS.next_behaviour_line} />
      <Button controlInfo={CONTROLS.previous_frame_with_detection} />
      <Button controlInfo={CONTROLS.hide_detection_boxes} />
      <Button controlInfo={CONTROLS.next_frame_with_detection} />
      <Button controlInfo={CONTROLS.previous_frame} />
      <Button controlInfo={playControl} />
      <Button controlInfo={CONTROLS.next_frame} />
      <Button controlInfo={CONTROLS.speed_down} />
      <button disabled />
      <Button controlInfo={CONTROLS.speed_up} />
      <Button controlInfo={CONTROLS.edit_comment_for_current_line} />
      <Button controlInfo={CONTROLS.zoom_toggle} />
      <Button controlInfo={CONTROLS.key_shortcut_help_toggle} />
    </div>
  </div>
}
