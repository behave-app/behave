import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { SideBar } from "./SideBar";
import { VideoPlayer } from "./VideoPlayer";
import { DetectionBar } from "./DetectionBar";
import { Behaviour } from "./Behaviour";
import { Settings } from "./Settings";
import { selectShowSettingsScreen } from "./appSlice";
import { useSelector } from "react-redux";
import { PlayerInfo } from "./PlayerInfo";
import { ShortcutHandler } from "./ShortcutHandler";
import { useEffect } from "react";
import { isCompatibleBrowser } from "../lib/util";

export const Viewer: FunctionComponent = () => {
  const showSettingsScreen = useSelector(selectShowSettingsScreen)
  useEffect(() => {
    if (!isCompatibleBrowser()) {
      alert(
        "This application has only been tested to run on Chrome 121 and higher. "
        + "If you continue on your current browser, things may not work."
      )
    }

  }, [])

  return <div className={css.viewer}>
    <SideBar />
    <VideoPlayer />
    <PlayerInfo />
    <DetectionBar />
    <Behaviour />
    {showSettingsScreen && <Settings />}
    <ShortcutHandler />
  </div>
}
