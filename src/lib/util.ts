export class AssertionError extends Error {}

export function assert(predicate: unknown, message?: string, dump?: unknown): asserts predicate {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!predicate) {
    console.error("Assertion failed: ", predicate, message, dump)
    throw new AssertionError(message ?? "Assertion failed")
  }
}

export function exhausted(key: never): null {
  throw new Error("Not exhausted " + key)
}

export function formatTime(totalseconds: number): string {
  const roundedSeconds = Math.round(totalseconds)
  return roundedSeconds < 3600
    ? formatTimeMSS(roundedSeconds)
    : formatTimeHMMSS(roundedSeconds)
}

export function formatTimeMSS(totalseconds: number): string {
  assert(totalseconds >= 0)
  const minutes = Math.floor(totalseconds / 60)
  const seconds = Math.round(totalseconds % 60)
  return [
  `${minutes}`,
  `${seconds}`.padStart(2, "0"),
  ].join(":")
}

export function formatTimeHMMSS(totalseconds: number): string {
  assert(totalseconds >= 0)
  const hours = Math.floor(totalseconds / 3600)
  const minutes = Math.floor(totalseconds % 3600 / 60)
  const seconds = Math.round(totalseconds % 60)
  return [
  `${hours}`,
  `${minutes}`.padStart(2, "0"),
  `${seconds}`.padStart(2, "0"),
  ].join(":")
}

export function getPromiseFromEvent<T extends string>(
  item: EventTarget,
  eventName: T
): Promise<Event> {
  return new Promise((resolve) => {
    const listener = (event: Event) => {
      item.removeEventListener(eventName, listener);
      resolve(event);
    }
    item.addEventListener(eventName, listener);
  })
}

export function promiseWithResolve<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // @ts-expect-error used before assigned
  return { promise, resolve, reject };
}

export function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeout_ms: number
): Promise<T | "timeout"> {
  return Promise.race([
    promise,
    asyncSleep(timeout_ms).then(() => "timeout" as const)
  ])
}

export async function asyncSleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

export function range(endOrStart: number, end?: number, step?: number): number[] {
  const [realStart, realEnd] = end === undefined ? [0, endOrStart] : [endOrStart, end]
  const realStep = step ?? 1
  const nrSteps = Math.ceil((realEnd - realStart) / realStep)
  if (nrSteps <= 0) {
      return []
  }
  return [...new Array(nrSteps)].map((_, i) => realStart + i * realStep)

}

export function binItems<T, K>(
  items: ReadonlyArray<T>, keyGen: (item: T, index: number) => K
): Map<K, T[]> {
  return items.reduce((myMap, item, index) => {
    const key = keyGen(item, index)
    return myMap.set(key, [...(myMap.get(key) ?? []), item])
  }, new Map<K, T[]>())
}

export function binIndices<T>(keys: T[]): Map<T, number[]> {
  return keys.reduce((myMap, key, index) =>
    myMap.set(key, [...(myMap.get(key) ?? []), index]), new Map<T, number[]>())
}

export function getDuplicateIndices(keys: unknown[]): number[][] {
  return [...binIndices(keys).values()].filter(v => v.length > 1)
}

export function elementsAreUnique(elements: unknown[]): boolean {
  return new Set(elements).size === elements.length
}

export async function* readLines(
  file: File
): AsyncGenerator<string, void, undefined> {
  const textDecoder = new TextDecoder('utf-8');
  const fileStream = file.stream().getReader();

  let partialLine = '';

  while (true) {
    const { done, value } = await fileStream.read();
    if (done) break;

    const chunk = textDecoder.decode(value, { stream: !done });
    const lines = (partialLine + chunk).split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      yield lines[i];
    }

    partialLine = lines[lines.length - 1];
  }

  if (partialLine) {
    yield partialLine;
  }
}

export function isCompatibleBrowser(): boolean {
  const userAgentString = navigator.userAgent;
  const chromeVersionMatch = userAgentString.match(/Chrome\/(\d+)/);

  if (chromeVersionMatch) {
    const versionNumber = parseInt(chromeVersionMatch[1], 10);
    return versionNumber >= 121;
  }

  return false;
}

declare let BEHAVE_VERSION: {version: string}
if (!(BEHAVE_VERSION as {version: string} | undefined)) {
  BEHAVE_VERSION = {version: "__UNKNOWN__"}
}
export function getBehaveVersion(): string {
  return BEHAVE_VERSION.version
}


export function TSAssertType<T>(_: unknown): asserts _ is T {}

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type OptionalKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T];

export type OptionalProperties<T> = {
  [K in OptionalKeys<T>]: Exclude<T[K], undefined>
}

export type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T];

export type RequiredProperties<T> = Pick<T, RequiredKeys<T>>;

export function joinedStringFromDict(dict: Record<string, boolean>, sep?: string): string {
  return Object.entries(dict)
    .filter(([_k, v]) => v).map(([k]) => k).join(sep ?? " ")
}

export function ObjectIsEmpty(obj: Record<string | number | symbol, unknown>): obj is Record<never, never> {
  return ObjectKeys(obj).length === 0
}

export function ObjectKeys<K extends string, V>(
  obj: Record<K, V>): ReadonlyArray<K> {
  return Object.keys(obj) as unknown as ReadonlyArray<K>
}

export function ObjectEntries<K extends string, V>(
  obj: Record<K, V>): ReadonlyArray<[K, V]> {
  return Object.entries(obj) as unknown as ReadonlyArray<[K, V]>
}

export function ObjectFromEntries<K extends string, V>(
  obj: ReadonlyArray<[K, V]>): {[key in K]: V} {
  return Object.fromEntries(obj) as unknown as {[key in K]: V}
}

export function enumerate<T>(arr: T[]): Array<[number, T]> {
  return arr.map((item, index) => [index, item] as const)
}

export function* enumerateGenerator<T>(
  gen: Generator<T, void, void>
): Generator<[number, T], void, void> {
  let index = 0
  for (const item of gen) {
    yield [index, item] as const
    index++
  }
}

export async function* enumerateAsyncGenerator<T>(
  gen: AsyncGenerator<T, void, void>
): AsyncGenerator<[number, T], void, void> {
  let index = 0
  for await (const item of gen) {
    yield [index, item] as const
    index++
  }
}

export type ValidRecordKey = string | number | symbol

export function ObjectGet<T extends object, K>(obj: T, key: K): K extends keyof T ? T[K] : K extends ValidRecordKey ? (T[keyof T] | undefined) : undefined;
export function ObjectGet<T extends object, K, D>(obj: T, key: K, defaultValue: D): K extends keyof T ? T[K] : K extends ValidRecordKey ? (T[keyof T] | D) : D;
export function ObjectGet<T extends object, K, D>(obj: T, key: K, defaultValue?: D): K extends keyof T ? T[K] : K extends ValidRecordKey ? (T[keyof T] | D | undefined) : (D | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isKey<T extends object>(obj: T, key: any): key is keyof T {
    return (key in obj)
  }
  if (isKey(obj, key)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return obj[key] as any
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return defaultValue as any
}

export function mayBeUndefined<T>(item: T): T | undefined {
  return item
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function valueOrError<T extends (...params: any[]) => any>(
  func: T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...params: Parameters<T>) => {value: ReturnType<T>} | {error: any} {
  return (...params) => {
    try {
      return {value: func(...params)}
    } catch (e) {
      return {error: e}
    }
  }
}

export type Serializable = null | boolean | number | string | {[key: string]: Serializable} | Array<Serializable>

export function* toJSONStringIterator(
  item: Serializable,
  // NOTE: demand that replacer returns Serializable or undefined,
  // disallow aray replacer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replacer?: ((this: any, key: string, value: any) => Serializable) | undefined,
  space?: string | number | undefined,
  __position?: string[],
  __parentObj?: Serializable,
): Generator<string, void, void> {
  const replacedItem = replacer ? replacer.bind(__parentObj ?? item)(
    __position ? __position.at(-1)! : "", item) : item
  if (replacedItem === null
    || typeof replacedItem === "number"
    || typeof replacedItem === "boolean"
    || typeof replacedItem === "string"
  ) {
    yield JSON.stringify(replacedItem)
    return
  }
  const indent = (__position ?? []).length
  const spaceStringItem = space === undefined ? ""
    : typeof space === "number" ? "\n" + new Array(space * (indent + 1)).join(" ")
      : "\n" + new Array(indent + 1).join(space)
  const spaceStringEnd = space === undefined ? ""
    : typeof space === "number" ? "\n" + new Array(space * indent).join(" ")
      : "\n" + new Array(indent).join(space)

  if (Symbol.iterator in replacedItem) {
    yield "["
    let first = true
    for (const [index, el] of Object.entries(replacedItem)) {
      const itemIterator = toJSONStringIterator(el, replacer, space, [...__position ?? [], index], replacedItem)
      const firstItem = itemIterator.next()
      assert(!firstItem.done)
      yield (first ? "" : ",") + spaceStringItem + firstItem.value!
      if (first) {
        first = false
      }
      yield* itemIterator
    }
    yield spaceStringEnd + "]"
  } else {
    yield "{"
    let first = true
    for (const [key, value] of Object.entries(replacedItem)) {
      assert(typeof key === "string")
      const itemIterator = toJSONStringIterator(value, replacer, space, [...__position ?? [], key], replacedItem)
      const firstItem = itemIterator.next()
      assert(!firstItem.done)
      yield (first ? "" : ",") + spaceStringItem + JSON.stringify(key) + ":" + firstItem.value
      if (first) {
        first = false
      }
      yield* itemIterator
    }
    yield spaceStringEnd + "}"
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function valueOrErrorAsync<T extends (...params: any[]) => Promise<any>>(
  func: T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...params: Parameters<T>) => Promise<{value: Awaited<ReturnType<T>>} | {error: any}> {
  return async (...params) => {
    try {
      return {value: await func(...params)}
    } catch (e) {
      return {error: e}
    }
  }
}

export function isTruthy<T>(param: T): param is Exclude<T, null> {
  return Boolean(param)
}

export async function debugImage(imageData: ImageData) {
  try {
    const c = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      const blob = await c.convertToBlob()
      const reader = new FileReader()
      const promise = getPromiseFromEvent(reader, "load")
      reader.readAsDataURL(blob)
      await promise
      const dataUri = reader.result
      const style = `font-size: 300px; background-image: url("${dataUri}"); background-size: contain; background-repeat: no-repeat;`;
      console.log("%c     ", style);
    }
  } catch (e) {
    console.error(e);
  }
}

