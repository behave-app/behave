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
