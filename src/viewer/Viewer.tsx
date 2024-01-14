import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { SideBar } from "./SideBar.js";
import { VideoPlayer } from "./VideoPlayer.js";
import { DetectionBar } from "./DetectionBar.js";
import { Behaviour } from "./Behaviour.js";
import { Settings } from "./Settings.js";
import { selectShowSettingsScreen } from "./appSlice";
import { useSelector } from "react-redux";
import { Controls } from "./Controls";

export const Viewer: FunctionComponent = () => {
  const showSettingsScreen = useSelector(selectShowSettingsScreen)

  return <div className={css.viewer}>
    <SideBar />
    <VideoPlayer />
    <Controls />
    <DetectionBar />
    <Behaviour />
    {showSettingsScreen && <Settings />}
  </div>
}
