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
