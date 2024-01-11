import { FunctionComponent } from "preact"
import * as css from "./settings.module.css"
import { useDispatch } from "react-redux"
import { settingsScreenHidden } from "./appSlice.js"
import { useState, useReducer } from "react"
import { Icon } from "src/lib/Icon"
import { ACTIONS } from "./VideoPlayer"
import { Key, InvalidKeyError,
  VideoShortcut, VideoShortcuts,
  SubjectShortcut, SubjectShortcuts,
  BehaviourShortcut, BehaviourShortcuts,
  SettingsState, selectSettings } from "./settingsSlice"
import { useSelector } from "react-redux"
import { SettingsShortcutsEditor } from "./SettingsShortcutsEditor.js"
import { assert } from "src/lib/util"


type Subscreen = null
| {
  type: "editShortcuts"
  shortcutsType: "video"
  name: string
} | {
  type: "editShortcuts"
  shortcutsType: "subject" | "behaviour"
  index: number
  name: string
}

function createSettingsShortcutsEditor(
  localSettings: SettingsState,
  setLocalSettings: (cb: (localSettings: SettingsState) => SettingsState) => void,
  subscreen: Subscreen & {type: "editShortcuts"},
  closeSubscreen: () => void,
) {
  assert(subscreen !== null && subscreen.type === "editShortcuts")
  const shortcuts = subscreen.shortcutsType === "video"
    ? localSettings.videoShortcuts
    : (subscreen.shortcutsType === "subject"
      ? localSettings.subjectShortcutsGroups
      : localSettings.behaviourShortcutsGroups)[subscreen.index].shortcuts
  return <SettingsShortcutsEditor
    type={subscreen.shortcutsType}
    shortcuts={shortcuts}
    closeWithoutUpdating={closeSubscreen}
    title={subscreen.name}
    updateShortcuts={updatedShortcuts => {
      setLocalSettings(localSettings => {
        const newLocalSettings = {...localSettings}
        switch (subscreen.shortcutsType) {
          case "video":
            newLocalSettings.videoShortcuts = updatedShortcuts
          break
          case "subject":
            newLocalSettings.subjectShortcutsGroups = [
              ...newLocalSettings.subjectShortcutsGroups]
            newLocalSettings.subjectShortcutsGroups[subscreen.index] = {
              name: newLocalSettings.subjectShortcutsGroups[subscreen.index].name,
              shortcuts: updatedShortcuts
            }
          break
          case "behaviour":
            newLocalSettings.behaviourShortcutsGroups = [
              ...newLocalSettings.behaviourShortcutsGroups]
            newLocalSettings.behaviourShortcutsGroups[subscreen.index] = {
              name: newLocalSettings.behaviourShortcutsGroups[subscreen.index].name,
              shortcuts: updatedShortcuts
            }
          break
          default:
            const exhaustive: never = subscreen
            throw new Error("Exhausted: " + exhaustive)
        }
        return newLocalSettings
      })
      closeSubscreen()
    }
    } />
  }

export const Settings: FunctionComponent = () => {
  const dispatch = useDispatch()
  const [subscreen, setSubscreen] = useState<Subscreen>(null)
  const [localSettings, setLocalSettings] = useState(useSelector(selectSettings))

  return <div className={css.background}>
    <div className={css.popup}>
      {subscreen === null
        ? <>
          <h1>Settings</h1>
          <h3>Video player shortcuts</h3>
          <div className={css.explanation}>
            Define keys to quickly navigate around the video (e.g. next detection, previous frame, start/pause play.
          </div>
          <div>
            {localSettings.videoShortcuts.filter(([key]) => key !== null).length} video shortcuts are active:
            {localSettings.videoShortcuts.filter(([key]) => key !== null).map(([key, action]) => <div className={css.keycombination} title={ACTIONS[action].description}>{key!.map(k => <kbd>{k}</kbd>)}</div>)}
          </div>
          <button onClick={() => setSubscreen({
            type: "editShortcuts",
            shortcutsType: "video",
            name: "Video player shortcuts"
          })}>Edit</button>
          <hr />
          <h3>Subject shortcuts</h3>
          <div className={css.explanation}>
            Define keys that will select a subject, and thereby start behaviour input.
            Multiple groups can be made, only one group can be active.
            Note that there can not be an overlap between these keys and video player shortcuts.
          </div>
          <div>
            <table className={css.shortcutGroups}>
              <thead>
                <tr>
                  <th className={css.shortcutGroupsName}>name</th>
                  <th className={css.shortcutGroupsShortcuts}>shortcuts</th>
                </tr>
              </thead>
              <tbody>
                {localSettings.subjectShortcutsGroups.map(
                  ({name, shortcuts}, index) => <tr>
                    <td className={css.shortcutGroupsName}>{name}</td>
                    <td className={css.shortcutGroupsShortcuts}>
                      {shortcuts.filter(([key]) => key !== null).map(([key, action]) =>
                        <div className={css.keycombination} title={action}>
                          {key!.map(k => <kbd>{k}</kbd>)}
                        </div>
                      )}
                    </td>
                    <td className={css.shortcutGroupsOperations}>
                      <button onClick={() => setSubscreen({
                        type: "editShortcuts",
                        shortcutsType: "subject",
                        index,
                        name: `Subject shortcuts for \"${name}\"`
                      })}>Edit</button>
                      <button disabled={localSettings.subjectShortcutsGroups.length < 2}
                        onClick={() => {
                        setLocalSettings(settings => {
                          if (settings.subjectShortcutsGroups.length < 2) {
                            return settings
                          }
                          const newGroups = settings.subjectShortcutsGroups.filter(
                            (_, i) => i !== index)
                          return {
                            ...settings,
                            subjectShortcutsGroups: newGroups
                          }})}
                      }><Icon iconName="delete" /></button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <button onClick={() => {
              setLocalSettings(settings => {
                const usedNames = new Set(
                  settings.subjectShortcutsGroups.map(({name}) => name))
                let name = "new"
                for (let i=1; usedNames.has(name); i++) {
                  name = `new (${i})`
                }
                const newGroups = [
                  ...settings.subjectShortcutsGroups,
                  {name, shortcuts: []}
                ]
                return {
                  ...settings,
                  subjectShortcutsGroups: newGroups
                }})}
            }><Icon iconName="add" /></button>
          </div>
          <hr />
          <button onClick={() => dispatch(settingsScreenHidden())}>close</button>
        </> : createSettingsShortcutsEditor(
          localSettings, setLocalSettings, subscreen, () => setSubscreen(null))
      }
    </div>
  </div>



}
