import { FunctionComponent } from "preact"
import { useState, } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Icon } from "../lib/Icon"
import { keyToStrings } from "../lib/key"
import { assert, joinedStringFromDict } from "../lib/util"
import { CONTROLS } from "./controls"
import { SettingsShortcutsEditor } from "./SettingsShortcutsEditor"
import { settingsScreenHidden } from "./appSlice"
import * as css from "./settings.module.css"
import {
    SettingsState,
    isBehaviourShortcutGroupsGroups,
    isSubjectShortcutGroupsGroups,
    noDuplicateOrInvalidGroupNames,
    noInvalidSettings,
    selectSettings,
    settingsUpdated,
  VideoShortcuts,
} from "./settingsSlice"

type Types = "video" | "behaviour" | "subject"


type Subscreen<T extends Types> = null
| (T extends "video" ? {
  type: "editShortcuts"
  shortcutsType: "video"
  name: string
} : {
  type: "editShortcuts"
  shortcutsType: "subject" | "behaviour"
  index: number
  name: string
})




function createSettingsShortcutsEditor<T extends Types>(
  localSettings: SettingsState,
  setLocalSettings: (cb: (localSettings: SettingsState) => SettingsState) => void,
  subscreen: Subscreen<T> & {type: "editShortcuts"},
  closeSubscreen: () => void,
) {
  assert(subscreen !== null && subscreen.type === "editShortcuts")
  const shortcuts = subscreen.shortcutsType === "video"
    ? localSettings.videoShortcuts
    : (subscreen.shortcutsType === "subject"
      ? localSettings.subjectShortcutsGroups.groups
      : localSettings.behaviourShortcutsGroups.groups)[subscreen.index].shortcuts
  return <SettingsShortcutsEditor
    type={subscreen.shortcutsType}
    shortcuts={shortcuts}
    closeWithoutUpdating={closeSubscreen}
    title={subscreen.name}
    updateShortcuts={updatedShortcuts => {
      setLocalSettings(localSettings => {
        const newLocalSettings = {...localSettings}
        switch (subscreen.shortcutsType) {
          case "video": {
            newLocalSettings.videoShortcuts = updatedShortcuts as VideoShortcuts
            break
          }
          case "subject":
          case "behaviour": {
            const shortcutsKey = subscreen.shortcutsType  === "subject" ? "subjectShortcutsGroups" : "behaviourShortcutsGroups"
            newLocalSettings[shortcutsKey] = {
              ...newLocalSettings[shortcutsKey],
              groups: [...newLocalSettings[shortcutsKey].groups]
            }
            newLocalSettings[shortcutsKey].groups[subscreen.index] = {
              ...newLocalSettings[shortcutsKey].groups[subscreen.index],
              shortcuts: updatedShortcuts
            }
            break
          }
          default: {
            const exhaustive: never = subscreen
            throw new Error("Exhausted: " + exhaustive)
          }
        }
        return newLocalSettings
      })
      closeSubscreen()
    }}
  />
}

function getValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function capitalize(s: string): string {
  if (s.length === 0) {
    return s;
  }
  return s[0].toLocaleUpperCase() + s.slice(1)
}

function downloadAsJson(data: unknown, filename: string) {
    const blob = new Blob(
    [JSON.stringify(data, undefined, 4)], {type: "application/json"})
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
}

async function uploadJson(filenameFilter?: RegExp): Promise<unknown> {
  try {
  const handlers = await window.showOpenFilePicker({ 
      id: "uploadJson",
      multiple: false,
      types: [{
        description: "JSON settings file",
        accept: {
          "application/json": [".json"]
        }}]
    })
    if (handlers.length !== 1) {
      return null
    }
    const file = await handlers[0].getFile()
    if (filenameFilter && !filenameFilter.test(file.name)) {
      if (!confirm("The selected file has a different filename from the usual files of this type. Continue with import anyways?")) {
        return null
      }
    }
    return JSON.parse(await file.text())
  } catch (e) {
    console.error("File picker failed: " + e)
    return null;
  }
}

type GroupedShortcutsProps<T extends "subject" | "behaviour"> = {
  localSettings: SettingsState,
  setLocalSettings: (cb: (localSettings: SettingsState) => SettingsState) => void,
  setSubscreen: (ss: Subscreen<T>) => void,
  shortcutsType: T
}
const GroupedShortcuts = <T extends "subject" | "behaviour">({
  localSettings, setLocalSettings, setSubscreen, shortcutsType
}: GroupedShortcutsProps<T>) => {
  const shortcutsKey = shortcutsType === "subject" ? "subjectShortcutsGroups" : "behaviourShortcutsGroups"
  const valid = noDuplicateOrInvalidGroupNames(localSettings[shortcutsKey])
  const duplicateNamesSet = new Set(
    valid === "ok" ? [] : (valid.duplicateGroupNames ?? []).flat())

  return <>
    <h3>{capitalize(shortcutsType)} shortcuts</h3>
    <div className={css.explanation}>
      {shortcutsType === "subject" ? <>Define keys that will select a subject, and thereby start behaviour input.</> : <><>Define keys that will select a behaviour, and thereby finish behaviour input.</></>}
      Multiple groups can be made, only one group can be active.
      Note that there can not be an overlap between active keys; i.e. the video shortcuts, the selected subject shortcuts group and the selected behaviour shortcuts group can not have the same key defined multiple times (for the simple reason that the program will not know what to do if the key in pressed in that case).
    </div>
    <div>
      <table className={css.shortcutGroups}>
        <thead>
          <tr>
            <th className={css.shortcutSelect}></th>
            <th className={css.shortcutGroupsName}>name</th>
            <th className={css.shortcutGroupsShortcuts}>shortcuts</th>
          </tr>
        </thead>
        <tbody>
          {localSettings[shortcutsKey].groups.map(
            ({name, shortcuts}, index) => <tr className={joinedStringFromDict({
              [css.selected]: localSettings[shortcutsKey].selectedIndex === index,
            })}>
              <td className={css.shortcutSelect}>
                <span onClick={() => setLocalSettings(settings => ({
                  ...settings,
                  [shortcutsKey]: {
                    ...settings[shortcutsKey],
                    selectedIndex: index
                  }}))}>
                  <Icon iconName={index === localSettings[shortcutsKey].selectedIndex
                    ? "check_box" : "check_box_outline_blank"} />
                </span>
              </td>
              <td className={joinedStringFromDict({
                [css.shortcutGroupsName]: true,
                [css.duplicate]: duplicateNamesSet.has(index),
              })}>
                <input type="text" value={name}
                  onChange={e => setLocalSettings(settings => {
                    const newSettings = {
                      ...settings,
                      [shortcutsKey]: {
                        ...settings[shortcutsKey],
                        groups: [...settings[shortcutsKey].groups]
                      }
                    }
                    newSettings[shortcutsKey].groups[index] = {
                      ...newSettings[shortcutsKey].groups[index],
                      name: getValue(e), 
                    }
                    return newSettings
                  })} />
              </td>
              <td className={css.shortcutGroupsShortcuts}>
                {shortcuts.filter(([key]) => key !== null).map(([key, action]) =>
                  <div className={css.keycombination} title={action}>
                    {keyToStrings(key!).map(k => <kbd>{k}</kbd>)}
                  </div>
                )}
              </td>
              <td className={css.shortcutGroupsOperations}>
                <button onClick={() => setSubscreen({
                  type: "editShortcuts",
                  shortcutsType: shortcutsType as "behaviour" | "subject",
                  index,
                  name: `${capitalize(shortcutsType)} shortcuts for "${name}"`
                } as Subscreen<T>)}>Edit</button>
                <button disabled={
                  localSettings[shortcutsKey].selectedIndex === index}
                  title={
                    localSettings[shortcutsKey].selectedIndex === index
                      ? "Cannot delete active shortcuts" : "Delete shortcut group" }
                  onClick={() => {
                    setLocalSettings(settings => {
                      if (settings[shortcutsKey].selectedIndex === index) {
                        return settings
                      }
                      const oldSelectedIndex = settings[shortcutsKey].selectedIndex
                      const newSelectedIndex = oldSelectedIndex - (
                        oldSelectedIndex < index ? 0 : 1)
                      const newGroups = {
                        ...settings[shortcutsKey],
                        selectedIndex: newSelectedIndex,
                      }
                      newGroups.groups = newGroups.groups.filter(
                        (_, i) => i !== index)
                      return {
                        ...settings,
                        [shortcutsKey]: newGroups
                      }})}
                  }><Icon iconName="delete" /></button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className={css.sectionbuttons}>
        <button onClick={() => {
          setLocalSettings(settings => {
            const usedNames = new Set(
              settings[shortcutsKey].groups.map(({name}) => name))
            let name = "new"
            for (let i=1; usedNames.has(name); i++) {
              name = `new (${i})`
            }
            const newGroups = {
              ...settings[shortcutsKey],
              groups: [
                ...settings[shortcutsKey].groups,
                {name, shortcuts: []}
              ]
            }
            return {
              ...settings,
              [shortcutsKey]: newGroups
            }})}
        }><Icon iconName="add" /></button>
        <button title={`export ${shortcutsType} shortcuts`} onClick={() =>
          downloadAsJson(
            localSettings[shortcutsKey].groups, `${shortcutsType}.shortcuts.json`)
        }><Icon iconName="download" /></button>
        <button title={`import ${shortcutsType} shortcuts from file`} onClick={() =>{
          void(uploadJson(new RegExp(`^${shortcutsType}\\.shortcuts.*\\.json$`)).then(shortcutGroups => {
            if (shortcutGroups === null) {
              return
            }
            const typeChecker = {
              "subject": isSubjectShortcutGroupsGroups,
              "behaviour": isBehaviourShortcutGroupsGroups,
            }[shortcutsType]
            if (!typeChecker(shortcutGroups)) {
              alert("File is corrupted")
              return
            }
            setLocalSettings(settings => {
              const newGroups = {
                ...settings[shortcutsKey],
                groups: [
                  ...settings[shortcutsKey].groups,
                  ...shortcutGroups,
                ]
              }
              return {
                ...settings,
                [shortcutsKey]: newGroups
              }
            })
          }))
        }}><Icon iconName="upload" /></button>
      </div>
    </div>
    <hr />
  </>
}

export const Settings: FunctionComponent = () => {
  const dispatch = useDispatch()
  const [subscreen, setSubscreen] = useState<Subscreen<Types>>(null)
  const [localSettings, setLocalSettings] = useState(useSelector(selectSettings))

  const validSettings = noInvalidSettings(localSettings)

  return <div className={css.background}>
    <div className={css.popup}>
      {subscreen === null
        ? <>
          <h1>Settings</h1>
          <div>
            Confidence:
            <input type="range" min="0.10" max="0.95" step="0.05"
              value={localSettings.confidenceCutoff}
              onChange={e => setLocalSettings(settings => ({
                ...settings,
                confidenceCutoff: parseFloat(getValue(e))}))} />
            {localSettings.confidenceCutoff}
          </div>
          <h3>Video player shortcuts</h3>
          <div className={css.explanation}>
            Define keys to quickly navigate around the video (e.g. next detection, previous frame, start/pause play.
          </div>
          <div>
            {localSettings.videoShortcuts.filter(([key]) => key !== null).length} video shortcuts are active:
            {localSettings.videoShortcuts.filter(([key]) => key !== null).map(([key, action]) => <div className={css.keycombination} title={CONTROLS[action].description}>{keyToStrings(key!).map(k => <kbd>{k}</kbd>)}</div>)}
          </div>
          <button onClick={() => setSubscreen({
            type: "editShortcuts",
            shortcutsType: "video",
            name: "Video player shortcuts"
          })}>Edit</button>
          <hr />
          <GroupedShortcuts shortcutsType="subject"
            {...{localSettings, setLocalSettings, setSubscreen}} />
          <GroupedShortcuts shortcutsType="behaviour"
            {...{localSettings, setLocalSettings, setSubscreen}} />
          <div className={css.submitbuttons}>
            {validSettings !== "ok" && <div class={css.errormessage}>
              {validSettings.videoShortcutsProblem ? <div>Problem with video playback shortcuts</div> : <></>}
              {validSettings.subjectShortcutsGroupsProblem ? <div>Problem with subject shortcuts</div> : <></>}
              {validSettings.behaviourShortcutsGroupsProblem ? <div>Problem with behaviour shortcuts</div> : <></>}
              {validSettings.videoControlsAndShortcutControlsOverlap ?<div>
                The following keys are defined both as video playback shortcuts as as subject shortcuts;
                this is not allowed since the system will not know what action you meant:
                <ul>
                  {validSettings.videoControlsAndShortcutControlsOverlap.map(
                    key => <li>{keyToStrings(key).map(k => <kbd>{k}</kbd>)}</li>)}
                </ul>
              </div> : <></>}
              {validSettings.subjectControlsAndBehaviourControlsOverlap ?<div>
                The following keys are defined both as subject shortcuts as as behaviour shortcuts;
                this is not allowed since the system will not know what action you meant:
                <ul>
                  {validSettings.subjectControlsAndBehaviourControlsOverlap.map(
                    key => <li>{keyToStrings(key).map(k => <kbd>{k}</kbd>)}</li>)}
                </ul>
              </div> : <></>}
              {validSettings.videoControlsAndBehaviourControlsOverlap ?<div>
                The following keys are defined both as video shortcuts as as behaviour shortcuts;
                this is not allowed since the system will not know what action you meant:
                <ul>
                  {validSettings.videoControlsAndBehaviourControlsOverlap.map(
                    key => <li>{keyToStrings(key).map(k => <kbd>{k}</kbd>)}</li>)}
                </ul>
              </div> : <></>}
            </div>}
            <button disabled={validSettings !== "ok"} onClick={() => {
              if (validSettings !== "ok") {
                console.log("Will not save invalid settings")
                return
              }
              dispatch(settingsScreenHidden())
              dispatch(settingsUpdated(localSettings))
            }}>Save &amp; close</button>
            <button onClick={() => {
              if (confirm("This will close this screen, without saving any of your changes. Do you want to continue?")) {
                dispatch(settingsScreenHidden())
              }
            }}>Discard changes &amp; close</button>
          </div>
        </> : createSettingsShortcutsEditor(
          localSettings, setLocalSettings, subscreen, () => setSubscreen(null))
      }
    </div>
  </div>



}
