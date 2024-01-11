import { FunctionComponent } from "preact"
import * as css from "./settings.module.css"
import { useDispatch } from "react-redux"
import { settingsScreenHidden } from "./appSlice.js"
import { useState, useReducer } from "react"
import { Key, InvalidKeyError,
  VideoShortcut, VideoShortcuts,
  SubjectShortcut, SubjectShortcuts,
  BehaviourShortcut, BehaviourShortcuts,
  SettingsState, selectSettings } from "./settingsSlice"
import { useSelector } from "react-redux"
import { SettingsShortcutsEditor } from "./SettingsShortcutsEditor.js"


export const Settings: FunctionComponent = () => {
  const dispatch = useDispatch()
  const [localSettings, setLocalSettings] = useState(useSelector(selectSettings))

  return <div className={css.background}>
    <div className={css.popup}>
      <h1>Settings</h1>
      <SettingsShortcutsEditor
        type="video"
        shortcuts={localSettings.videoShortcuts}
        updateShortcuts={s => console.log(s)}
      />
      <button onClick={() => dispatch(settingsScreenHidden())}>close</button>
    </div>
  </div>



}
