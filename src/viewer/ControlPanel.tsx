import { FunctionComponent } from "preact";
import * as viewercss from "./viewer.module.css"
import * as css from "./controlpanel.module.css"
import { useSelector } from "react-redux";
import { selectPlaybackRate, selectPlayerState } from "./videoPlayerSlice";
import { selectCurrentFrameDateTime, selectCurrentFrameNumber} from "./selectors";
import { CONTROLS } from "./controls";
import { Button } from "./Button";
import { formatDateTimeParts } from "../lib/datetime";
import { selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut, selectZoomLevel } from "./appSlice";
import { selectActiveBehaviourShortcutPreset, selectActiveSubjectShortcutPreset, } from "./shortcutsSlice";
import { ObjectEntries } from "../lib/util";
import { useAppDispatch } from "./store";
import { toggleBehaviourInfoCurrentlySelectedSubject } from "./behaviourSlice";
import { keyToStrings } from "../lib/key";
import { Icon } from "../lib/Icon";
import { addBehaviourLine } from "./reducers";


const ControlPanelDetails: FunctionComponent = () => {
  const currentFrameNumber = useSelector(selectCurrentFrameNumber)
  const currentDateTime = useSelector(selectCurrentFrameDateTime)

  return <div>
    <div>Framenumber: {currentFrameNumber}</div>
    {currentDateTime && 
      <div>
        {formatDateTimeParts(currentDateTime, "%Y-%m-%d %H:%M:%S")}
      </div>}
  </div>
}

const ControlPanelGeneralControls: FunctionComponent = () => {
  const playbackSpeed = useSelector(selectPlaybackRate)
  const zoomLevel = useSelector(selectZoomLevel)
  return <>
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
    </>
}

const ControlPanelOtherControls: FunctionComponent<{
  type: "subject" | "behaviour"}> = ({type}) => {
  const subjects = useSelector(type === "subject" ?
    selectActiveSubjectShortcutPreset : selectActiveBehaviourShortcutPreset)
  const active = useSelector(type === "subject" ?
    selectIsWaitingForSubjectShortcut : selectIsWaitingForBehaviourShortcut)
  const dispatch = useAppDispatch()

  return <>
      {ObjectEntries(subjects.shortcuts).map(([action, keys]) =>
        <button disabled={!active} title={action + (keys.length ? " (shortcut: "
        + keys.map(key => keyToStrings(key).join("-")).map(k => "`" + k + "`").join(", ")
        + ")": "")}
        onClick={async () => {if (active) {
          if (type === "subject") {
            await dispatch(toggleBehaviourInfoCurrentlySelectedSubject(action))
          } else {
            await dispatch(addBehaviourLine(action))
          }
      }}}>
      <Icon iconName={type === "subject" ? "cruelty_free" : "sprint"} />
        {action}
        </button>
    )}
    </>
}

export const ControlPanel: FunctionComponent = () => {
  const playerState = useSelector(selectPlayerState)

  return <div className={viewercss.controlpanel}>
    <div>
      {playerState && <ControlPanelDetails />}
    </div>
    <div className={css.general_controls}>
      <ControlPanelGeneralControls />
    </div>
    <div className={css.other_controls}>
      <h2>Subjects</h2>
      <ControlPanelOtherControls type="subject" />
    </div>
    <div className={css.other_controls}>
      <h2>Behaviours</h2>
      <ControlPanelOtherControls type="behaviour" />
    </div>
  </div>
}
