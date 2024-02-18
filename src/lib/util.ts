export class AssertionError extends Error {}

export function assert(predicate: boolean, message?: string): asserts predicate {
  if (!predicate) {
    throw new AssertionError(message ?? "Assertion failed")
  }
}

export function formatTime(totalseconds: number): string {
  return totalseconds < 3600
    ? formatTimeMSS(totalseconds)
    : formatTimeHMMSS(totalseconds)
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

export function ObjectKeys<K extends string, V>(
  obj: Record<K, V>): ReadonlyArray<K> {
  return Object.keys(obj) as unknown as ReadonlyArray<K>
}

export function ObjectEntries<K extends string, V>(
  obj: Record<K, V>): ReadonlyArray<[K, V]> {
  return Object.entries(obj) as unknown as ReadonlyArray<[K, V]>
}
