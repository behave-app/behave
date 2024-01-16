import { FunctionComponent } from "preact"
import { selectActiveShortcuts } from "./settingsSlice"
import { useSelector } from "react-redux"
import { useEffect } from "react"
import { store, useAppDispatch } from "./store"
import { keyFromEvent, keyToString } from "src/lib/key"
import { CONTROL_INFO_S } from "./PlayerInfo"

export const ShortcutHandler: FunctionComponent = () => {
  const activeShortcuts = useSelector(selectActiveShortcuts)
  const dispatch = useAppDispatch()

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const keyObject = keyFromEvent(ev)
      if (keyObject === null) {
        return
      }
      const keyString = keyToString(keyObject)
      if (!activeShortcuts.has(keyString)) {
        return
      }
      const {key: _key, type, action} = activeShortcuts.get(keyString)!
      if (type === "video") {
        const control = CONTROL_INFO_S[action]
        if (control.selectIsDisabled && control.selectIsDisabled(store.getState())) {
          console.log(`Video action ${action} is currently disabled`)
          return
        }
        control.action(dispatch)
      }
    }
    document.documentElement.addEventListener("keydown", onKeyDown)
    return () => document.documentElement.removeEventListener("keydown", onKeyDown)
  }, [activeShortcuts])
  return <></>
}

