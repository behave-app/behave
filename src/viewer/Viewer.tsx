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
import { assert, isCompatibleBrowser, joinedStringFromDict, mayBeUndefined } from "../lib/util";
import { selectPlayerInfoShown } from "./generalSettingsSlice";
import { MultipleActionsAssignedToPressedKeyException, appErrorSet, selectAppError, selectSidebarPopup, sidebarPopupWasClosed} from "./appSlice"
import { ClassSliders } from "./ClassSliders"
import { Info } from "./Info"
import { Dialog, suppressShortcutsSelector } from "../lib/Dialog"
import { useAppDispatch } from "./store"
import { keyFromEvent, keyToString } from "../lib/key";
import { selectActionByKeyString } from "./shortcutsSlice";
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

function multipleActionsAssignedToPressedKeyException(
  error: Omit<MultipleActionsAssignedToPressedKeyException, "error">
): MultipleActionsAssignedToPressedKeyException {
  return {
    ...error,
    error: "MultipleActionsAssignedToPressedKeyException",
  }
}

const ShortcutsHandler: FunctionComponent = () => {
  const actionAndShortcutsStateKeyByKeyString = useSelector(selectActionByKeyString)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = keyFromEvent(e)
      if (key === null) {
        return;
      }
      if (document.querySelector(suppressShortcutsSelector) !== null) {
        return
      }
      const actionAndShortcutsStateKeys = mayBeUndefined(
        actionAndShortcutsStateKeyByKeyString[keyToString(key)])
      if (actionAndShortcutsStateKeys) {
        e.preventDefault()
        assert(actionAndShortcutsStateKeys.length > 0)
        if (actionAndShortcutsStateKeys.length === 1) {
          void(dispatch(executeShortcutAction(actionAndShortcutsStateKeys[0])))
        } else {
          dispatch(appErrorSet(multipleActionsAssignedToPressedKeyException({
            key: actionAndShortcutsStateKeys[0].key,
            actions: actionAndShortcutsStateKeys.map(
              ({shortcutsStateKey, action}) => ({shortcutsStateKey, action}))
            })))
        }
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [actionAndShortcutsStateKeyByKeyString])

  return null
}
