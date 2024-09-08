import { OptionalProperties, RequiredProperties } from "./util"

type ValidRecordKey = string | number | symbol

class TypeCheckerError extends Error {
  constructor (
    path: string,
    reason : string,
    public readonly value: unknown,
    public readonly errors?: ReadonlyArray<TypeCheckerError>
  ) {
    super(`TypeCheckerError at ${path}: ${reason}`)
    return
  }
}

export abstract class Checker<T> {
  private readonly valid: (value: T) => boolean
  constructor(
    options: {
      valid: ((s: T) => boolean) | undefined
    }) {
    this.valid = options?.valid ?? (() => true)
  }

  isInstance(value: unknown): value is T {
    try {
      this._assertInstance(value, "")
      return true
    } catch (e) {
      if (e instanceof TypeCheckerError) {
        console.error(e)
        console.error({value: e.value, errors: e.errors})
        return false
      }
      throw e
    }
  }

  assertInstance(value: unknown): asserts value is T {
    this._assertInstance(value, "")
  }

  _assertInstance(value: unknown, path: string): asserts value is T {
    this._assertInstanceIgnoreValid(value, path)
    if (!this.valid(value)) {
      throw new TypeCheckerError(path, "valid function failed", value)
    }
  }

  protected abstract _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is T;
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
  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is T {
    if (!this.items.has(value as T)) {
      throw new TypeCheckerError(path, `${value} not in ${[...this.items]}`, value)
    }
  }
}

export class UnknownChecker extends Checker<unknown> {
  constructor(
    options?: {
      valid?: (s: unknown) => boolean
    }) {
    super({valid: options?.valid})
  }
  _assertInstanceIgnoreValid(value: unknown, _path: string): asserts value is unknown {
    return
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
  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is keyof T {
    if (!this.items.has(value as keyof T)) {
      throw new TypeCheckerError(path, `{$value} not in ${this.items}`, value)
    }
  }
}

export class NullChecker extends Checker<null> {
  constructor(
    options?: {
      valid?: (s: null) => boolean
    }) {
    super({valid: options?.valid})
  }
  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is null {
    if (value !== null) {
      throw new TypeCheckerError(path, `${value} is not null`, value)
    }
  }
}

export class BooleanChecker extends Checker<boolean> {
  constructor(
    options?: {
      valid?: (s: boolean) => boolean
    }) {
    super({valid: options?.valid})
  }
  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is boolean {
    if (!(typeof value === "boolean")) {
      throw new TypeCheckerError(path, `${value} is not a boolean`, value)
    }
  }
}

export class StringChecker extends Checker<string> {
  constructor(
    options?: {
      valid?: (s: string) => boolean
      regexp?: RegExp
    }) {
    const valid = (s: string): boolean => {
      if (options?.regexp && s.match(options.regexp)?.at(0) !== s) {
        return false
      }
      if (options?.valid && !options.valid(s)) {
        return false
      }
      return true
    }
    super({valid: valid})
  }
  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is string {
    if (!(typeof value === "string")) {
      throw new TypeCheckerError(path, `${value} is not a string`, value)
    }
  }
}

export class NumberChecker extends Checker<number> {
  constructor(
    options?: {
      isInt?: boolean,
      isFinite?: boolean,
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
      if (options?.min !== undefined) {
        if (n < options.min) {
          return false
        }
      }
      if (options?.max !== undefined) {
        if (n > options.max) {
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

  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is number {
    if (!(typeof value === "number")) {
      throw new TypeCheckerError(path, `${value} is not a number`, value)
    }
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

  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is Array<ItemWithoutCheckerRecursive<T>> {
    if (!Array.isArray(value)) {
      throw new TypeCheckerError(path, `${value} is not an Array`, value)
    }
    value.map((el, index) => this.itemChecker._assertInstance(el, `${path}[${index}]`))
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

  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is ItemWithoutCheckerRecursive<T> {
    if (!(Array.isArray(value) && this.itemChecker.length === value.length)) {
      throw new TypeCheckerError(path, `${value} is not an array of length ${this.itemChecker.length}`, value)
    }
    value.forEach((el, index) => this.itemChecker[index]._assertInstance(el, `${path}.${index}`))
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
  readonly requiredItemChecker: {[key in keyof Req]: Checker<ItemWithoutCheckerRecursive<Req[key]>>}
  readonly optionalItemChecker: {[key in keyof Opt]: Checker<ItemWithoutCheckerRecursive<Opt[key]>>}
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

  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is CombineReqAndOptRemoveCheckers<Req, Opt> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeCheckerError(path, `${value} is not an object`, value)
    }
    if (!Object.keys(this.requiredItemChecker).every(key => key in value)) {
      const keys = new Set(Object.keys(this.requiredItemChecker))
      Object.keys(value).forEach(k => keys.delete(k))
      throw new TypeCheckerError(path, `Value is missing keys ${[...keys]}`, value)
    }
    if (!Object.keys(value).every(
      key => key in this.requiredItemChecker || key in this.optionalItemChecker)) {
      const keys = new Set(Object.keys(value))
      Object.keys(this.requiredItemChecker).forEach(k => keys.delete(k))
      Object.keys(this.optionalItemChecker).forEach(k => keys.delete(k))
      throw new TypeCheckerError(path, `Value has extra keys ${[...keys]}`, value)
    }
    const combinedItemChecker = {
      ...this.requiredItemChecker,
      ...this.optionalItemChecker,
    }
    Object.keys(value).forEach(key => {
      const checker = combinedItemChecker[key]
      const val = value[key as keyof typeof value]
      void(checker._assertInstance(val, `${path}.${key}`))
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

  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is Record<ItemWithoutCheckerRecursive<K>, ItemWithoutCheckerRecursive<V>> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeCheckerError(path, `${value} is not an object`, value)
    }
    Object.entries(value).forEach(([key, val], index) => {
      this.keyChecker._assertInstance(key, `keyof ${index} (${path})`);
      this.valueChecker._assertInstance(val, `${path}.${key}`)
    })
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

  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is ItemWithoutCheckerRecursive<T[number]> {
    const errors: TypeCheckerError[] = []
    for (let index = 0; index < this.checkers.length; index++) {
      const checker = this.checkers[index]
      try {
        void(checker._assertInstance(value, `${path}<${index}>`))
      } catch (e) {
        if (e instanceof TypeCheckerError) {
          errors.push(e)
          continue
        } else {
          throw e
        }
      }
      return 
    }
    throw new TypeCheckerError(path, "None of union paths match", value, errors)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypeChecker<T> extends Checker<T> {
  constructor(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    private type: new (...args: any[]) => T,
    options?: {
      valid?: (s: T) => boolean
    }) {
    super({valid: options?.valid})
  }
  _assertInstanceIgnoreValid(value: unknown, path: string): asserts value is T {
    if (!(value instanceof this.type)) {
      throw new TypeCheckerError(path, `${value} is not a ${this.type.name}`, value)
    }
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

