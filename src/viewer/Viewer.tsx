import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { SideBar } from "./SideBar";
import { VideoPlayer } from "./VideoPlayer";
import { DetectionBar } from "./DetectionBar";
import { Behaviour } from "./Behaviour";
import { useSelector } from "react-redux";
import { PlayerInfo } from "./PlayerInfo";
import { KeyShortcuts } from "./KeyShortcuts";
import { useEffect } from "react";
import { ObjectEntries, isCompatibleBrowser, joinedStringFromDict } from "../lib/util";
import { selectPlayerInfoShown } from "./generalSettingsSlice";
import { selectSidebarPopup, sidebarPopupWasClosed} from "./appSlice"
import { ClassSliders } from "./ClassSliders"
import { Info } from "./Info"
import { Dialog } from "../lib/Dialog"
import { useAppDispatch } from "./store"
import { keyFromEvent, keyToString } from "src/lib/key";
import { createSelector } from "@reduxjs/toolkit";
import { ShortcutGroup, ShortcutsState, selectActiveBehaviourShortcutGroup, selectActiveGeneralShortcutGroup, selectActiveSubjectShortcutGroup } from "./shortcutsSlice";
import { executeShortcutAction } from "./reducers";

export const Viewer: FunctionComponent = () => {
  const playerInfoShown = useSelector(selectPlayerInfoShown)
  useEffect(() => {
    if (!isCompatibleBrowser()) {
      alert(
        "This application has only been tested to run on Chrome 121 and higher. "
        + "If you continue on your current browser, things may not work."
      )
    }

  }, [])

  return <div className={joinedStringFromDict({
    [css.viewer]: true,
    [css.no_controls]: !playerInfoShown,
  })}>
    <ShortcutsHandler />
    <Popup />
    <SideBar />
    <VideoPlayer />
    {playerInfoShown && <PlayerInfo />}
    <DetectionBar />
    <Behaviour />
  </div>
}

const Popup: FunctionComponent = () => {
  const popup = useSelector(selectSidebarPopup)
  const dispatch = useAppDispatch()
  return popup && <Dialog onRequestClose={() => dispatch(sidebarPopupWasClosed())}>
    {(() => {
      switch (popup) {
        case "info":
          return <Info />
        case "classSliders":
          return <ClassSliders />
        case "keyShortcuts":
          return <KeyShortcuts onRequestClose={() => dispatch(sidebarPopupWasClosed())} /> 
        default: {
          const exhaust: never = popup
          throw new Error(`Exhausted: ${exhaust}`)
        }
      }
    })()}
  </Dialog>
}

const selectActionAndShortcutsStateKeyByKeyString = createSelector(
  [selectActiveGeneralShortcutGroup, selectActiveSubjectShortcutGroup, selectActiveBehaviourShortcutGroup], (generalGroup, subjectGroup, behaviourGroup) => {
  const groups: Record<keyof ShortcutsState, ShortcutGroup<string>> = {
      "generalShortcuts": generalGroup,
      "subjectShortcuts": subjectGroup,
      "behaviourShortcuts": behaviourGroup,
    }
    return Object.fromEntries(ObjectEntries(groups).flatMap(
      ([shortcutsStateKey, group]) => ObjectEntries(group.shortcuts).flatMap(
        ([action, keys]) => keys.map(
          key => [keyToString(key), {
            action,
            shortcutsStateKey
          }]))))
  }
)

const ShortcutsHandler: FunctionComponent = () => {
  const actionAndShortcutsStateKeyByKeyString = useSelector(
    selectActionAndShortcutsStateKeyByKeyString)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = keyFromEvent(e)
      if (!key) {
        return;
      }
      const actionAndShortcutsStateKey = actionAndShortcutsStateKeyByKeyString[
        keyToString(key)]
      if (actionAndShortcutsStateKey) {
        void(dispatch(executeShortcutAction(actionAndShortcutsStateKey)))
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [actionAndShortcutsStateKeyByKeyString])

  return null
}
