import { FunctionComponent } from "preact"
import * as css from "./viewer.module.css"
import { SideBar } from "./SideBar";
import { VideoPlayer } from "./VideoPlayer";
import { DetectionBar } from "./DetectionBar";
import { Behaviour } from "./Behaviour";
import { useSelector } from "react-redux";
import { ControlPanel } from "./ControlPanel";
import { KeyShortcuts } from "./KeyShortcuts";
import { useEffect } from "react";
import { assert, exhausted, isCompatibleBrowser, joinedStringFromDict, mayBeUndefined } from "../lib/util";
import { selectBehaviourBarShown, selectBehaviourBarSize, selectControlPanelShown, selectDetectionBarShown, selectDetectionBarSize } from "./generalSettingsSlice";
import { MultipleActionsAssignedToPressedKeyException, appErrorSet, fullscreenSet, lastKeyPressedSet, selectAppError, selectFullscreen, selectSidebarPopup, sidebarPopupWasClosed, sidebarPopupWasToggled} from "./appSlice"
import { ClassSliders } from "./ClassSliders"
import { Uploader } from "./Uploader"
import { Info } from "./Info"
import { Dialog, suppressShortcutsSelector } from "../lib/Dialog"
import { useAppDispatch } from "./store"
import { keyFromEvent, keyToString } from "../lib/key";
import { selectActionByKeyString } from "./shortcutsSlice";
import { executeShortcutAction } from "./reducers";
import { ErrorPopup } from "./Error";
import { Sizer} from "./Sizer"

export const Viewer: FunctionComponent = () => {
  const controlPaneShown = useSelector(selectControlPanelShown)
  const detectionBarShown = useSelector(selectDetectionBarShown)
  const detectionBarSize = useSelector(selectDetectionBarSize)
  const behaviourBarShown = useSelector(selectBehaviourBarShown)
  const behaviourBarSize = useSelector(selectBehaviourBarSize)
  const dispatch = useAppDispatch()
  const error = useSelector(selectAppError)

  useEffect(() => {
    if (!isCompatibleBrowser()) {
      alert(
        "This application has only been tested to run on Chrome 121 and higher. "
        + "If you continue on your current browser, things may not work."
      )
    }

  }, [])


  useEffect(() => {
  const onFullscreenChange = () => {
      dispatch(fullscreenSet(!!document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  return <div className={joinedStringFromDict({
    [css.viewer]: true,
    [css.no_controlpanel]: !controlPaneShown,
    [css.no_detectionbar]: !detectionBarShown,
    [css.no_behaviourbar]: !behaviourBarShown,
  })} style={{
      "--behaviourbar-height": `${behaviourBarSize.toFixed(1)}vh`,
      "--detectionbar-height": `${detectionBarSize.toFixed(1)}vh`,
    }}>
    {error && <ErrorPopup error={error} />}
    <ShortcutsHandler />
    <Popup />
    <SideBar />
    <VideoPlayer />
    {controlPaneShown && <ControlPanel />}
    {detectionBarShown && <DetectionBar />}
    {behaviourBarShown && <Behaviour />}
  </div>
}

const Popup: FunctionComponent = () => {
  const popup = useSelector(selectSidebarPopup)
  const fullscreen = useSelector(selectFullscreen)
  const dispatch = useAppDispatch()
  const noSuppressShortcuts = popup === "keyShortcuts"
  const closePopup = () => dispatch(sidebarPopupWasClosed())

  useEffect(() => {
    if (popup && fullscreen) {
      console.warn("Popup and fullscreen do not go together, because of Chrome bug")
      console.warn("When file picker is opened while in full screen on mac....")
      void(document.exitFullscreen())
    }
  }, [popup, fullscreen])


  useEffect(() => {
    if (popup === "uploader") {
      return
    }
    const aimedAt = window.document.documentElement
    const dragEnter = (event: DragEvent) => {
      if (!event.dataTransfer || event.dataTransfer.items.length === 0) {
        return
      }
      if ([...event.dataTransfer.items].every(item => item.kind !== "file")) {
        return
      }
      dispatch(sidebarPopupWasToggled("uploader"))
    }
    aimedAt.addEventListener("dragenter", dragEnter)
    return () => aimedAt.removeEventListener("dragenter", dragEnter)

  }, [popup])
  return popup && <Dialog noSuppressShortcuts={noSuppressShortcuts}
    className={css[`popup_${popup}`]}
    onRequestClose={closePopup} onClose={closePopup}>
    {(() => {
      switch (popup) {
        case "info":
          return <Info />
        case "classSliders":
          return <ClassSliders onRequestClose={closePopup} />
        case "keyShortcuts":
          return <KeyShortcuts onRequestClose={closePopup} /> 
        case "uploader":
          return <Uploader onRequestClose={closePopup} /> 
        case "sizer":
          return <Sizer /> 
        default: {
          exhausted(popup)
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
          dispatch(lastKeyPressedSet(key))
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
