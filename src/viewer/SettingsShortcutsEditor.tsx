import { FunctionComponent } from "preact"
import { ACTIONS } from "./VideoPlayer"
import * as css from "./settingsshortcutseditor.module.css"
import { Icon } from "src/lib/Icon"

import { Key, InvalidKeyError,
  VideoShortcut, VideoShortcuts,
  SubjectShortcut, SubjectShortcuts,
  BehaviourShortcut, BehaviourShortcuts,
  SettingsState, selectSettings } from "./settingsSlice"
import { useState, useEffect, useCallback } from "react"

type Props = {
  type: "video"
  shortcuts: VideoShortcuts,
  updateShortcuts: (shortcuts: VideoShortcuts) => void,
} | {
  type: "subject"
  shortcuts: SubjectShortcuts,
  updateShortcuts: (shortcuts: SubjectShortcuts) => void,
} | {
  type: "behaviour"
  shortcuts: BehaviourShortcuts,
  updateShortcuts: (shortcuts: BehaviourShortcuts) => void,
}

function addShortcut<T extends VideoShortcut | SubjectShortcut | BehaviourShortcut>(
  shortcuts: T[],
  shortcut: T,
  ): T[] {
  return [
    ...shortcuts,
    shortcut
  ]
}
  
function removeShortcut(shortcuts: VideoShortcuts, shortcut: VideoShortcut): VideoShortcuts;
function removeShortcut(shortcuts: SubjectShortcuts, shortcut: SubjectShortcut): SubjectShortcuts;
function removeShortcut(shortcuts: BehaviourShortcuts, shortcut: BehaviourShortcut): BehaviourShortcuts;
function removeShortcut(
  shortcuts: VideoShortcuts | SubjectShortcuts | BehaviourShortcuts,
  shortcut: VideoShortcut | SubjectShortcut | BehaviourShortcut
): VideoShortcuts | SubjectShortcuts | BehaviourShortcuts {
  const [keyToRemove, actionToRemove] = shortcut
  const keyToRemoveStr = keyToRemove.toString()
  return shortcuts.filter(([key, action]) => !(
    action === actionToRemove && key.toString() === keyToRemoveStr))
}
  
function getValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

export const SettingsShortcutsEditor: FunctionComponent<Props> = ({
  type,
  shortcuts,
  updateShortcuts,
}) => {
  const [localShortcuts, setLocalShortcuts] = useState(shortcuts)
  const [recordKey, setRecordKey] = useState<number>()

  const actions = type === "video" ? Object.fromEntries(Object.entries(ACTIONS)
    .map(([key, {description}]) => [key, description])
  ) : null

  const updateLocalShortcuts = (
  index: number,
  update: Partial<{key: typeof shortcuts[0][0], action: typeof shortcuts[0][1]}>
  ) => {
    setLocalShortcuts(localShortcuts => {
      const newShortcuts = [...localShortcuts]
      newShortcuts[index] = [
      "key" in update ? update.key! : newShortcuts[index][0],
      "action" in update ? update.action! : newShortcuts[index][1],
      ]
      return newShortcuts
    })

  }

  useEffect(() => {
    if (recordKey === undefined) {
      return
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.key in Key.MODIFIER_KEYS) {
        // ignore
        return
      }
      const modifiers = [
        ...event.shiftKey ? ["Shift"] : [],
        ...event.metaKey ? ["Meta"] : [],
        ...event.altKey ? ["Alt"] : [],
        ...event.ctrlKey ? ["Control"] : [],
      ] as Array<keyof typeof Key["MODIFIER_KEYS"]>
      const key = new Key(event.key, modifiers)
      updateLocalShortcuts(recordKey, {key: key.toKeyStrings()})
      setRecordKey(undefined)
    }
    window.document.documentElement.addEventListener("keyup", keyUp)
    return () => {
      window.document.documentElement.removeEventListener("keyup", keyUp)
    }
  }, [recordKey])


  const defaultAction = actions ? Object.keys(actions)[0] : ""

  const indicesByKey = localShortcuts.reduce(
    (prev, [keyStrings, ], index) => {
      if (keyStrings === null) {
        return prev
      }
      const key = keyStrings.join("-")
      return prev.set(key, [...prev.get(key) ?? [], index])
    }, new Map<string, number[]>())

  const duplicates = new Set(
    [...indicesByKey.values()].filter(v => v.length > 1).flat())

  return <div>
    <table className={css.shortcuts}>
      <thead>
        <tr>
          <th>nr</th>
          <th>key</th>
          <th>{type} shortcut</th>
        </tr>
      </thead>
      <tbody>
        {localShortcuts.map(([key, action], index) => {
          const recording = recordKey === index
          return <tr className={duplicates.has(index) ? css.duplicate : ""}>
            <td>{index + 1}.</td>
            <td onClick={recording ? undefined : () => setRecordKey(index)}
              className={recording ? css.recordKey: ""}>
              {recording ? <span>Press key...
                <button onClick={() => setRecordKey(undefined)}>cancel</button>
              </span> : key ? key.map(k => <kbd>{k}</kbd>) : "No key set"}
            </td>
            <td>
              {actions
                ? <select
                  onChange={e => updateLocalShortcuts(index, {action: getValue(e)})}
                  value={action ?? Object.keys(actions)[0]}>
                  {Object.entries(actions).map(
                    ([key, value]) => <option value={key}>{value}</option>)}
                </select>
                : <input
                  onChange={e => updateLocalShortcuts(index, {action: getValue(e)})}
                  value={action ?? ""} />
              }
            </td>
            <td className="delete">
              <Icon iconName="delete" onClick={
                  () => setLocalShortcuts(s => s.filter((_, i) => i !== index))} />
            </td>
          </tr>
        })}
      </tbody>
    </table>
    {/* @ts-expect-error: TS not smart enough that localShortcuts is right type */}
    <button onClick={() => setLocalShortcuts(s => [...s, [null, defaultAction]])}>+</button>
    <button onClick={() => updateShortcuts(localShortcuts)}>OK</button>
    <button onClick={() => setLocalShortcuts(shortcuts)}>Reset</button>
  </div>
}
