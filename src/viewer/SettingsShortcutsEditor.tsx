import { FunctionComponent } from "preact"
import { ACTIONS } from "./Controls.js"
import * as css from "./settingsshortcutseditor.module.css"
import { Icon } from "src/lib/Icon"

import { selectStringsFromDict } from "src/lib/util"
import { keyFromEvent, keyToStrings, } from "../lib/key.js"
import {
  VideoShortcuts, SubjectShortcuts, BehaviourShortcuts, noDuplicateKeysInShortcuts, } from "./settingsSlice"
import { useState, useEffect, } from "react"

type Props = {
  type: "video"
  shortcuts: VideoShortcuts,
  updateShortcuts: (shortcuts: VideoShortcuts) => void,
  closeWithoutUpdating: () => void,
  title: string,
} | {
  type: "subject"
  shortcuts: SubjectShortcuts,
  updateShortcuts: (shortcuts: SubjectShortcuts) => void,
  closeWithoutUpdating: () => void,
  title: string,
} | {
  type: "behaviour"
  shortcuts: BehaviourShortcuts,
  updateShortcuts: (shortcuts: BehaviourShortcuts) => void,
  closeWithoutUpdating: () => void,
  title: string,
}

function getValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

export const SettingsShortcutsEditor: FunctionComponent<Props> = ({
  type,
  shortcuts,
  updateShortcuts,
  closeWithoutUpdating,
  title,
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
      const key = keyFromEvent(event)
      if (key === null) {
        return
      }
      updateLocalShortcuts(recordKey, {key})
      setRecordKey(undefined)
    }
    window.document.documentElement.addEventListener("keyup", keyUp)
    return () => {
      window.document.documentElement.removeEventListener("keyup", keyUp)
    }
  }, [recordKey])


  const defaultAction = actions ? Object.keys(actions)[0] : ""

  const valid = noDuplicateKeysInShortcuts(localShortcuts)
  const duplicates = valid === "ok" ? [] : valid.duplicateKeyMappings
  const duplicatesSet = new Set(duplicates.flat())

  return <div>
    <h2>{title}</h2>
    <div>
      Below you can customize the keyboard shortcuts.
      Note that not all key combinations are always available on all systems,
      since they may be used by the operating system.
      For instance, on Windows it will not be able to assign anything to <kbd>Ctrl</kbd><kbd>C</kbd>, since that is already being used for "copy"; on a Mac computer however, one is able to use this (since there <kbd>Cmd</kbd><kbd>C</kbd> is used for copying).
    </div>
    <div>
      Note that letters below are always shown as uppercase letters.
      However <kbd>B</kbd> means that a lowercase b should be typed, whereas <kbd>Shift</kbd><kbd>B</kbd> means a Shift-B should be typed.
      <kbd>B</kbd> stands for the <em>key</em> "B" on your keyboard (which is also uppercase mpost of the time), not for the <em>letter</em> B.
    </div>
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
            <td className={selectStringsFromDict({
              [css.keycolumn]: true,
              [css.duplicate]: duplicatesSet.has(index),
              [css.recordKey]: recording,
            })}>
              {recording ? <>
                <span>Press key...</span>
                <button className={css.buttons} onClick={() => setRecordKey(undefined)}>cancel</button>
              </>
                : <>
                  {key ? keyToStrings(key).map(k => <kbd>{k}</kbd>): "No key set"}
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
      {duplicates.length > 0 && <div class={css.duplicateserrormessage}>
        The same key is used in lines {
          duplicates.map(dups =>
            dups.slice(0, -1).map(i => `${i}`).join(", ") + ` and ${dups.at(-1)}`
          ).join("; ")}
      </div>}
      <button disabled={duplicates.length > 0}
        onClick={() => updateShortcuts(localShortcuts)}>Save &amp; close</button>
      <button onClick={() => {
        if (confirm("This will close this screen, without saving any of your changes. Do you want to continue?")) {
          closeWithoutUpdating()
        }
      }}>Discard &amp; close</button>
    </div>
  </div>
}
