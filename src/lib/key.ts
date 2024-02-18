import { ArrayChecker, Checker, KeyOfChecker, ObjectChecker, } from "./typeCheck"
import { MODIFIER_KEYS, KEYCODE_BY_DISPLAY } from "./defined_keys"
import { binIndices, elementsAreUnique } from "./util"

export class InvalidKeyError extends Error {}

export type SupportedKeycode = keyof typeof KEYCODE_BY_DISPLAY
export type Modifier = keyof typeof MODIFIER_KEYS


export type Key = {
  modifiers?: Modifier[]
  code: SupportedKeycode
}

export const keyChecker: Checker<Key> = new ObjectChecker({
  required: {
    code: new KeyOfChecker(KEYCODE_BY_DISPLAY),
  },
  optional: {
    modifiers: new ArrayChecker(
      new KeyOfChecker(MODIFIER_KEYS),
      {valid: modifiers => elementsAreUnique(modifiers)}
    ),
  }
})

export function keyFromEvent(e: KeyboardEvent): Key | null {
  if (e.code in KEYCODE_BY_DISPLAY) {
    const code = e.code as SupportedKeycode
    const modifiers = (Object.keys(MODIFIER_KEYS) as Array<keyof typeof MODIFIER_KEYS>).filter((key) => e[key])
    return { modifiers, code }
  }
  return null
}

export function keyToStrings(key: Key): string[] {
  return [
    ...(key.modifiers ?? []).map(m => MODIFIER_KEYS[m]),
    KEYCODE_BY_DISPLAY[key.code]
  ]
}

export function keyToString(key: Key): string {
  return keyToStrings(key).join("-")
}

export function areEqualKeys(key1: Key | null, key2: Key | null): boolean {
  if (key1 === null && key2 === null) {
    return true
  }
  if (key1 === null || key2 === null) {
    return false
  }
  return keyToString(key1) === keyToString(key2)
}

export function isKey(key: unknown): key is Key {
  if (!key || typeof key !== "object") {
    return false
  }
  const keyLength = Object.keys(key).length
  if (! ("code" in key) || typeof key.code !== "string") {
    return false
  }
  if (!(key.code in KEYCODE_BY_DISPLAY)) {
    return false
  }
  if (keyLength === 1) {
    return true
  }
  if (keyLength !== 2) {
    return false
  }
  if (! ("modifiers" in key)
    || !Array.isArray(key.modifiers)
    || !key.modifiers.every(m => typeof m !== "string")) {
    return false
  }
  const indices = key.modifiers.map(m => Object.keys(MODIFIER_KEYS).findIndex(m))
  let lastSeenIndex = -1
  for (const index of indices) {
    if (index <= lastSeenIndex) {
      return false
      }
      lastSeenIndex = index
  }
  return true
}

