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
import { ObjectEntries, isCompatibleBrowser, joinedStringFromDict, mayBeUndefined } from "../lib/util";
import { selectPlayerInfoShown } from "./generalSettingsSlice";
import { selectAppError, selectSidebarPopup, sidebarPopupWasClosed} from "./appSlice"
import { ClassSliders } from "./ClassSliders"
import { Info } from "./Info"
import { Dialog, suppressShortcutsSelector } from "../lib/Dialog"
import { useAppDispatch } from "./store"
import { keyFromEvent, keyToString } from "../lib/key";
import { createSelector } from "@reduxjs/toolkit";
import { ShortcutPreset, ShortcutsState, selectActiveBehaviourShortcutPreset, selectActiveGeneralShortcutPreset, selectActiveSubjectShortcutPreset } from "./shortcutsSlice";
import { executeShortcutAction } from "./reducers";
import { ErrorPopup } from "./Error";

export const Viewer: FunctionComponent = () => {
  const playerInfoShown = useSelector(selectPlayerInfoShown)
  const error = useSelector(selectAppError)
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
    {error && <ErrorPopup error={error} />}
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
  const noSuppressShortcuts = popup === "keyShortcuts"
  return popup && <Dialog noSuppressShortcuts={noSuppressShortcuts}
    onRequestClose={() => dispatch(sidebarPopupWasClosed())}>
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
  [selectActiveGeneralShortcutPreset, selectActiveSubjectShortcutPreset, selectActiveBehaviourShortcutPreset], (generalPreset, subjectPreset, behaviourPreset) => {
  const presets: Record<keyof ShortcutsState, ShortcutPreset<string>> = {
      "generalShortcuts": generalPreset,
      "subjectShortcuts": subjectPreset,
      "behaviourShortcuts": behaviourPreset,
    }
    return Object.fromEntries(ObjectEntries(presets).flatMap(
      ([shortcutsStateKey, preset]) => ObjectEntries(preset.shortcuts).flatMap(
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
      if (document.querySelector(suppressShortcutsSelector) !== null) {
        return
      }
      const actionAndShortcutsStateKey = mayBeUndefined(
        actionAndShortcutsStateKeyByKeyString[keyToString(key)])
      if (actionAndShortcutsStateKey) {
        e.preventDefault()
        void(dispatch(executeShortcutAction(actionAndShortcutsStateKey)))
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [actionAndShortcutsStateKeyByKeyString])

  return null
}
