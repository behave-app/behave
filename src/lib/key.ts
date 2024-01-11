export class InvalidKeyError extends Error {}

export class Key {
  public static MODIFIER_KEYS = {
    "Shift": "Shift",
    "Control": "Ctrl",
    "Alt": "Alt",
    "Meta": "Cmd",
  } as const

  public static SPECIAL_KEYS = {
    "Enter": "Enter",
    "Tab": "Tab",
    " ": "Space",
    "\u00a0": "Space", // generated by alt-space: no break space
    "ArrowDown": "down arrow",
    "ArrowUp": "up arrow",
    "ArrowLeft": "left arrow",
    "ArrowRight": "right arrow",
    "End": "End",
    "Home": "Home",
    "PageDown": "PageDown",
    "PageUp": "PageUp",
    "Backspace": "Backspace",
    "F1": "F1",
    "F2": "F2",
    "F3": "F3",
    "F4": "F4",
    "F5": "F5",
    "F6": "F6",
    "F7": "F7",
    "F8": "F8",
    "F9": "F9",
    "F10": "F10",
    "F11": "F11",
    "F12": "F12",
    "F13": "F13",
    "F14": "F14",
    "F15": "F15",
    "F16": "F16",
    "F17": "F17",
    "F18": "F18",
    "F19": "F19",
    "F20": "F20",
    "Escape": "Esc",
  } as const

  public readonly modifiers: Set<keyof typeof Key.MODIFIER_KEYS>
  public readonly key: string

  constructor(
    key: string,
    modifiers?: Iterable<keyof typeof Key.MODIFIER_KEYS>,
  ){
    this.modifiers = new Set(modifiers ?? [])
    if (key in Key.SPECIAL_KEYS) {
      this.key = key
    } else {
      if (key.length === 1) {
        this.key = key.toLocaleUpperCase()
      } else {
        throw new InvalidKeyError("Invalid key: " + key)
      }
    }
  }

  toKeyStrings(): string[] {
    return [
      ...Object.entries(Key.MODIFIER_KEYS)  // keep this order
        .filter(([k, _v]) => this.modifiers.has(k as keyof typeof Key.MODIFIER_KEYS))
        .map(([_k, v]) => v),
      this.key in Key.SPECIAL_KEYS
        ? Key.SPECIAL_KEYS[this.key as keyof typeof Key.SPECIAL_KEYS]
        : this.key,
    ]
  }

  static fromKeyStrings(parts: string[]): Key {
    const modifiers = parts.slice(0, -1) as Array<keyof typeof Key.MODIFIER_KEYS>
    const key = parts[parts.length - 1]
    return new Key(key, modifiers)
  }

  toString(): string {
    return this.toKeyStrings().join("-")
  }
}

export type SerializableKey = string[]
