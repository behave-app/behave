import { Icon, } from "../lib/Icon";
import { useAppDispatch, } from "./store"
import { joinedStringFromDict, ObjectEntries } from "../lib/util";
import { ControlInfo, CONTROLS } from "./controls";
import { useSelector } from "react-redux";
import * as css from "./button.module.css"
import { createSelector } from "@reduxjs/toolkit";
import { Key, areEqualKeys, keyToStrings } from "../lib/key";
import { selectActiveGeneralShortcutPreset } from "./shortcutsSlice";
import { selectLastKeyPressed } from "./appSlice";
import { useEffect, useState } from "react";

const selectShortcutKeysByControlinfo = createSelector(
  [selectActiveGeneralShortcutPreset], (group) => {
    return new Map(ObjectEntries(group.shortcuts).map(([action, keys]) => {
      return [CONTROLS[action], keys]
    }))
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Button<CI extends ControlInfo<any>>(
  {controlInfo}: {controlInfo: CI}
) {
  type T = CI extends ControlInfo<infer T> ? T : never
  const dispatch = useAppDispatch()
  const disabled = useSelector(controlInfo.selectIsDisabled)
  const activated = useSelector(controlInfo.selectIsActivated)
  const actionArgument: T = useSelector(
    // this allows us to use selectors that would error when disabled = true
    disabled ? (() => undefined as T): controlInfo.selectActionArgument)
  const shortcutKeysByControlInfo = useSelector(selectShortcutKeysByControlinfo)
  const shortcutKeys = shortcutKeysByControlInfo.get(
    controlInfo as Parameters<typeof shortcutKeysByControlInfo["get"]>[0]) ?? []
  const lastKeyPressed = useSelector(selectLastKeyPressed)
  const [pressAnimation, setPressAnimation] = useState<null | Key>(null)

  useEffect(() => {
    if (shortcutKeys.some(key => areEqualKeys(key, lastKeyPressed))) {
      setPressAnimation(lastKeyPressed)
      setTimeout(() => setPressAnimation(pressAnimation =>
        pressAnimation === lastKeyPressed ? null : pressAnimation), 100)
    }
  }, [lastKeyPressed])

  return <button
    disabled={disabled}
    title={controlInfo.description + (shortcutKeys.length ? " (shortcut: "
      + shortcutKeys.map(key => keyToStrings(key).join("-")).map(k => "`" + k + "`").join(", ")
      + ")": "")}
    className={joinedStringFromDict({
      [css.activated]: activated,
      [css.control]: true,
      [css.press_animation]: !disabled && !!pressAnimation,
    })} onClick={() => {if (!disabled) {
      controlInfo.action(dispatch, actionArgument)}}}>
    <Icon iconName={controlInfo.iconName} />
    {controlInfo.subIconName && <div className={
      [css.subIcon, css.topRight].join(" ")}>
      <Icon iconName={controlInfo.subIconName} />
    </div>}
  </button>
}

