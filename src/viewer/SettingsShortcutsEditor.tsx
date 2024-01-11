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

function classNamesFromDict(dict: Record<string, boolean>): string {
  return Object.entries(dict)
    .filter(([_k, v]) => v).map(([k]) => k).join(" ")
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
          <th className={css.nrcolumn}>nr</th>
          <th className={css.keycolumn}>key</th>
          <th className={css.actioncolumn}>{type} shortcut</th>
        </tr>
      </thead>
      <tbody>
        {localShortcuts.map(([key, action], index) => {
          const recording = recordKey === index
          return <tr>
            <td className={css.nrcolumn}>{index + 1}.</td>
            <td className={classNamesFromDict({
              [css.keycolumn]: true,
              [css.duplicate]: duplicates.has(index),
              [css.recordKey]: recording,
            })}>
              {recording ? <>
                <span>Press key...</span>
                <button className={css.buttons} onClick={() => setRecordKey(undefined)}>cancel</button>
              </>
                : <>
                  {key ? key.map(k => <kbd>{k}</kbd>): "No key set"}
                  <div className={css.buttons}>
                    {key && <button onClick={() => {
                      updateLocalShortcuts(index, {key: null})
                      setRecordKey(undefined)
                    }}><Icon iconName="delete" /></button>}
                    <button onClick={() => setRecordKey(index)}>change</button>
                  </div>
                </>}
            </td>
            <td className={css.actioncolumn}>
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
            <td className={css.deletecolumn}>
              <button onClick={
                () => setLocalShortcuts(s => s.filter((_, i) => i !== index))}>
                <Icon iconName="delete" />
              </button>
            </td>
          </tr>
        })}
      </tbody>
    </table>
    {/* // @ts-expect-error: TS not smart enough that localShortcuts is right type  -- but it doesn't always give an error.... */}
    <button onClick={() => setLocalShortcuts(s => [...s, [null, defaultAction]])}>+</button>
    <div className={css.submitbuttons}>
      {duplicates.size > 0 && <div class={css.duplicateserrormessage}>
        The same key is used in lines {
          [...duplicates].sort((a, b) => a - b).map(n => n.toString())
          .join(", ").replace(/, (\d+)$/, " and $1")}.
      </div>}
      <button disabled={duplicates.size > 0}
        onClick={() => updateShortcuts(localShortcuts)}>Save &amp; close</button>
      <button onClick={() => {
        if (confirm("This will reset all changes made since opening this screen, do you want to continue?")) {
          setLocalShortcuts(shortcuts)
        }
      }}>Reset</button>
    </div>
  </div>
}
