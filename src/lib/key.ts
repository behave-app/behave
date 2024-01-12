export class InvalidKeyError extends Error {}

export const MODIFIER_KEYS = {
    shiftKey: "Shift",
    ctrlKey: "Ctrl",
    altKey: "Alt",
    metaKey: "Cmd",
  } as const

export type Key = {
  modifiers?: Modifier[]
  code: SupportedKeycode
}

export type SupportedKeycode = keyof typeof KEYCODE_BY_DISPLAY
export type Modifier = keyof typeof MODIFIER_KEYS

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

export const KEYCODE_BY_DISPLAY = {
    Enter: "Enter",
    Space: "Space",
    ArrowDown: "ArrowDown",
    ArrowUp: "ArrowUp",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    End: "End",
    Home: "Home",
    PageDown: "PageDown",
    PageUp: "PageUp",
    Delete: "Delete",
    BracketRight: "]",
    BracketLeft: "[",
    Quote: "'",
    Semicolon: ";",
    Backslash: "\\",
    Comma: ",",
    Slash: "/",
    Period: ".",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    IntlBackslash: "§",
    NumpadDecimal: "Num .",
    NumpadMultiply: "Num *",
    NumpadAdd: "Num +",
    NumpadDivide: "Num /",
    NumpadEnter: "Num Enter",
    NumpadSubtract: "Num -",
    NumpadEqual: "Num =",
    Numpad0: "Num 0",
    Numpad1: "Num 1",
    Numpad2: "Num 2",
    Numpad3: "Num 3",
    Numpad4: "Num 4",
    Numpad5: "Num 5",
    Numpad6: "Num 6",
    Numpad7: "Num 7",
    Numpad8: "Num 8",
    Numpad9: "Num 9",
    F0: "F0",
    F1: "F1",
    F2: "F2",
    F3: "F3",
    F4: "F4",
    F5: "F5",
    F6: "F6",
    F7: "F7",
    F8: "F8",
    F9: "F9",
    F10: "F10",
    F11: "F11",
    F12: "F12",
    F13: "F13",
    F14: "F14",
    F15: "F15",
    F16: "F16",
    F17: "F17",
    F18: "F18",
    F19: "F19",
    F20: "F20",
    F21: "F21",
    F22: "F22",
    F23: "F23",
    F24: "F24",
    Digit0: "0",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
    Digit4: "4",
    Digit5: "5",
    Digit6: "6",
    Digit7: "7",
    Digit8: "8",
    Digit9: "9",
    KeyA: "A",
    KeyB: "B",
    KeyC: "C",
    KeyD: "D",
    KeyE: "E",
    KeyF: "F",
    KeyG: "G",
    KeyH: "H",
    KeyI: "I",
    KeyJ: "J",
    KeyK: "K",
    KeyL: "L",
    KeyM: "M",
    KeyN: "N",
    KeyO: "O",
    KeyP: "P",
    KeyQ: "Q",
    KeyR: "R",
    KeyS: "S",
    KeyT: "T",
    KeyU: "U",
    KeyV: "V",
    KeyW: "W",
    KeyX: "X",
    KeyY: "Y",
    KeyZ: "Z",
  } as const
