import { OptionalProperties, RequiredProperties } from "./util"

type ValidRecordKey = string | number | symbol

export abstract class Checker<T> {
  private readonly valid: (value: T) => boolean
  constructor(
    options: {
      valid: ((s: T) => boolean) | undefined
    }) {
    this.valid = options?.valid ?? (() => true)
  }

  isInstance(value: unknown): value is T {
    return this._isInstance(value) && this.valid(value)
  }
  protected abstract _isInstance(value: unknown): value is T;
}

export class LiteralChecker<T extends boolean | string | number | null | undefined | symbol> extends Checker<T> {
  private items: Set<T>
  constructor(
    itemOrItems: T | Array<T>,
    options?: {
      valid?: (s: T) => boolean
    }) {
    super({valid: options?.valid})
    this.items = new Set(Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems])
  }
  _isInstance(value: unknown): value is T {
    return this.items.has(value as T)
  }
}

// NOTE: supporting non-string keys opens a whole new can or worms!
export class KeyOfChecker<T extends Record<string, unknown>> extends Checker<keyof T> {
  private items: Set<keyof T>
  constructor(
    object: T,
    options?: {
      valid?: (s: keyof T) => boolean
    }) {
    super({valid: options?.valid})
    this.items = new Set(Object.keys(object))
  }
  _isInstance(value: unknown): value is keyof T {
    return this.items.has(value as keyof T)
  }
}

export class NullChecker extends Checker<null> {
  constructor(
    options?: {
      valid?: (s: null) => boolean
    }) {
    super({valid: options?.valid})
  }
  _isInstance(value: unknown): value is null {
    return value === null
  }
}

export class BooleanChecker extends Checker<boolean> {
  constructor(
    options?: {
      valid?: (s: boolean) => boolean
    }) {
    super({valid: options?.valid})
  }
  _isInstance(value: unknown): value is boolean {
    return typeof value === "boolean"
  }
}

export class StringChecker extends Checker<string> {
  constructor(
    options?: {
      valid?: (s: string) => boolean
      regexp?: RegExp
    }) {
    const valid = (s: string): boolean => {
      if (options?.regexp && s.match(options.regexp)?.at(0) === s) {
        return false
      }
      if (options?.valid && !options.valid(s)) {
        return false
      }
      return true
    }
    super({valid: valid})
  }
  _isInstance(value: unknown): value is string {
    return typeof value === "string"
  }
}

export class NumberChecker extends Checker<number> {
  constructor(
    options?: {
      isInt?: boolean,
      min?: number,
      max?: number,
      valid?: (n: number) => boolean
    }) {

    const valid = (n: number) => {
      if (options?.isInt) {
        if (n % 1 !== 0) {
          return false
        }
      }
      if (options?.min) {
        if (n > options.min) {
          return false
        }
      }
      if (options?.max) {
        if (n < options.max) {
          return false
        }
      }
      if (options?.valid) {
        if (!options.valid(n)) {
          return false
        }
      }
      return true
    }
    super({valid: valid})
  }

  _isInstance(value: unknown): value is number {
    return typeof value === "number"
  }
}

export class ArrayChecker<T> extends Checker<Array<ItemWithoutCheckerRecursive<T>>> {
  private itemChecker: Checker<ItemWithoutCheckerRecursive<T>>
  constructor(
    itemChecker: T,
    options?: {
      valid?: (s: Array<ItemWithoutCheckerRecursive<T>>) => boolean
    }) {
    super({valid: options?.valid})
    this.itemChecker = getCheckerFromObject(itemChecker)
  }

  _isInstance(value: unknown): value is Array<ItemWithoutCheckerRecursive<T>> {
    return Array.isArray(value) && value.every(
      el => this.itemChecker.isInstance(el))
  }
}

export class TupleChecker<T extends unknown[]> extends Checker<ItemWithoutCheckerRecursive<T>> {
  private itemChecker: (T extends [...infer X] ? {[P in keyof X]: X[P] extends infer U ? Checker<U> : never} : never)
  constructor(
    itemChecker: T,
    options?: {
      valid?: (s: ItemWithoutCheckerRecursive<T>) => boolean
    }) {
    super({valid: options?.valid})
    this.itemChecker = itemChecker.map(el => getCheckerFromObject(el)) as typeof this.itemChecker
  }

  _isInstance(value: unknown): value is ItemWithoutCheckerRecursive<T> {
    return Array.isArray(value)
      && this.itemChecker.length === value.length
      && value.every((el, index) => this.itemChecker[index].isInstance(el))
  }
}

export type ObjectWithOptionalsChecker<T extends Record<string, unknown>> = ObjectChecker<RequiredProperties<T>, OptionalProperties<T>>

export type CombineReqAndOptRemoveCheckers<Req extends Record<string, unknown>, Opt extends Record<string, unknown>> = {
  [key in keyof (Req & Partial<Opt>)]:
  ItemWithoutCheckerRecursive<
  key extends keyof Req ? Req[key] : key extends keyof Opt ? Opt[key]: never>
}

export class ObjectChecker<
Req extends Record<ValidRecordKey, unknown>,
Opt extends Record<ValidRecordKey, unknown>,
> extends Checker<CombineReqAndOptRemoveCheckers<Req, Opt>> {
  private requiredItemChecker: {[key in keyof Req]: Checker<ItemWithoutCheckerRecursive<Req[key]>>}
  private optionalItemChecker: {[key in keyof Opt]: Checker<ItemWithoutCheckerRecursive<Opt[key]>>}
  constructor(
    data: {
      required: Req,
      optional?: Opt,
    },
    options?: {
      valid?: (s: CombineReqAndOptRemoveCheckers<Req, Opt>) => boolean
      extraKeysAllowed?: boolean
    }) {
    super({valid: options?.valid})
    this.requiredItemChecker = Object.fromEntries(Object.entries(data.required).map(([key, value]) => [key, getCheckerFromObject(value)])) as typeof this.requiredItemChecker
    this.optionalItemChecker = Object.fromEntries(Object.entries(data.optional ?? {}).map(([key, value]) => [key, getCheckerFromObject(value)])) as typeof this.optionalItemChecker
    const usedKeys = new Set<string>(Object.keys(this.requiredItemChecker))
    for (const key in this.optionalItemChecker) {
      if (key in usedKeys) {
        throw new Error(`Key ${key} already in requiredItemChecker`)
      }
    }
  }

  _isInstance(value: unknown): value is CombineReqAndOptRemoveCheckers<Req, Opt> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    if (!Object.keys(this.requiredItemChecker).every(key => key in value)) {
      return false
    }
    if (!Object.keys(value).every(
      key => key in this.requiredItemChecker || this.optionalItemChecker)) {
      return false
    }
    const combinedItemChecker = {
      ...this.requiredItemChecker,
      ...this.optionalItemChecker,
    }
    return Object.keys(value).every(key => {
      const checker = combinedItemChecker[key]
      const val = value[key as keyof typeof value]
      return checker.isInstance(val)
    })
  }
}

export class RecordChecker<K extends ValidRecordKey, V> extends Checker<Record<ItemWithoutCheckerRecursive<K>, ItemWithoutCheckerRecursive<V>>> {
  private keyChecker: Checker<ItemWithoutCheckerRecursive<K>>
  private valueChecker: Checker<ItemWithoutCheckerRecursive<V>>
  constructor({keyChecker, valueChecker}: {
    keyChecker: K | Checker<K>,
    valueChecker: V,
  },
    options?: {
      valid?: (s: Record<ItemWithoutCheckerRecursive<K>, ItemWithoutCheckerRecursive<V>>) => boolean
    }) {
    super({valid: options?.valid})
    this.keyChecker = getCheckerFromObject(keyChecker)
    this.valueChecker = getCheckerFromObject(valueChecker)
  }

  _isInstance(value: unknown): value is Record<ItemWithoutCheckerRecursive<K>, ItemWithoutCheckerRecursive<V>> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    return Object.entries(value).every(
      ([key, val]) => this.keyChecker.isInstance(key) && this.valueChecker.isInstance(val))
  }
}

export class UnionChecker<T extends unknown[]> extends Checker<ItemWithoutCheckerRecursive<T[number]>> {
  private checkers: Checker<ItemWithoutCheckerRecursive<T[number]>>[]
  constructor(
    checkers: T,
    options?: {valid?: (s: ItemWithoutCheckerRecursive<T[number]>) => boolean},
  ) {
  super({valid: options?.valid})
  this.checkers = checkers.map(checker => getCheckerFromObject(checker)) as typeof this.checkers
  }

  _isInstance(value: unknown): value is ItemWithoutCheckerRecursive<T[number]> {
    return this.checkers.some(checker => checker.isInstance(value))
  }
}


type ItemWithoutCheckerRecursive<T> = (
T extends Checker<infer C>
? ItemWithoutCheckerRecursive<C>
: T extends {[key: string]: unknown}
? {[key in keyof T]: ItemWithoutCheckerRecursive<T[key]>}
: T extends [...infer X] ? {[P in keyof X]: X[P] extends infer U ? ItemWithoutCheckerRecursive<U> : never}
: T
)

// eslint-disable-next-line @typescript-eslint/ban-types -- we need {} here
export function getCheckerFromObject<T extends Record<string, unknown>>(obj: T): ObjectChecker<ItemWithoutCheckerRecursive<T>, {}>;
export function getCheckerFromObject<T>(obj: T): Checker<ItemWithoutCheckerRecursive<T>>;
export function getCheckerFromObject<T>(obj: T): Checker<ItemWithoutCheckerRecursive<T>> {
  type Ret = Checker<ItemWithoutCheckerRecursive<T>> 
  if (typeof obj === "boolean") {
    return new BooleanChecker() as unknown as Ret
  }
  if (typeof obj === "string") {
    return new StringChecker() as unknown as Ret
  }
  if (typeof obj === "number") {
    return new NumberChecker() as unknown as Ret
  }
  if (obj instanceof Checker) {
    return obj
  }
  if (obj === null) {
    return new NullChecker as unknown as Ret
  }
  if (Array.isArray(obj)) {
    // @ts-expect-error  TODO fix
    return new TupleChecker(obj.map(el => getCheckerFromObject(el)))
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error("Unsupported type")
  }
  
  return new ObjectChecker({required: Object.fromEntries([...Object.entries(obj)].map(([key, val]) => [key, getCheckerFromObject(val)])), optional: {}}) as unknown as Ret

}

