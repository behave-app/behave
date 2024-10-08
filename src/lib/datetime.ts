export type ISODateTimeString = `isodate:${number}-${number}-${number}T${number}:${number}:${number}${"" | `.${number}`}${"Z" | `${"+" | "-"}${number}${":" |""}${number}`}`
export const ISODATETIMESTRINGREGEX = /^isodate:(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?<subseconds>|\.\d+)(?<tz>Z|(?<tzSign>[+-])(?<tzHours>\d{2}):?(?<tzMinutes>\d{2}))$/

export type DateTimeParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
  tz: string
  date: Date,
  tzOffsetHours: number
}

export function getLocalPartsFromDateObject(
  date: Date,
  tz: string,
  tzOffsetHours: number,
): DateTimeParts {
  const p2 = (n: number) => n.toString().padStart(2, "0")
  const p4 = (n: number) => n.toString().padStart(4, "0")
  const localDate = new Date(date.valueOf() + tzOffsetHours * 3600 * 1000)
  return {
    date,
    year: p4(localDate.getUTCFullYear()),
    month: p2(localDate.getUTCMonth() + 1),
    day: p2(localDate.getUTCDate()),
    hour: p2(localDate.getUTCHours()),
    minute: p2(localDate.getUTCMinutes()),
    second: p2(localDate.getUTCSeconds()),
    tz,
    tzOffsetHours,
  }
}

export function offsetParts(
  parts: DateTimeParts,
  offset: {
    seconds?: number,
    hours?: number,
  }
): DateTimeParts {
  return getLocalPartsFromDateObject(
    new Date(parts.date.valueOf()
    + (offset.seconds ?? 0) * 1000
    + (offset.hours ?? 0) * 3600 * 1000),
    parts.tz, parts.tzOffsetHours)
}

export function getPartsFromTimestamp(
  ts: ISODateTimeString
): DateTimeParts {
  const match = ts.match(ISODATETIMESTRINGREGEX)
  if (!match || !match.groups) {
    throw new Error("No timestamp: " + ts)
  }
  const dateInfo = {
    year: match.groups.year,
    month: match.groups.month,
    day: match.groups.day,
    hour: match.groups.hour,
    minute: match.groups.minute,
    second: match.groups.second,
    tz: match.groups.tz,
  }
  const tzOffsetHours = dateInfo.tz === "Z" ? 0
  : {"+": 1, "-": -1}[match.groups.tzSign]! * (parseInt(match.groups.tzHours) + parseInt(match.groups.tzMinutes) / 60)
  return {
    ...dateInfo,
    date: new Date(Date.parse(ts.slice("isodate:".length))),
    tzOffsetHours,
  }
}

export function formatDateTimeParts(parts: DateTimeParts, format: string): string {
  return format.replaceAll(/%./g, match => {
    switch (match) {
      case "%Y": return parts.year
      case "%m": return parts.month
      case "%d": return parts.day
      case "%H": return parts.hour
      case "%M": return parts.minute
      case "%S": return parts.second
      case "%%": return "%"
      default:
        throw new Error(`Unknown format: ${match}`)
    }
  })
}

export function partsToIsoDate(parts: DateTimeParts): ISODateTimeString {
  return "isodate:" + formatDateTimeParts(parts, "%Y-%m-%dT%H:%M:%S") + parts.tz as ISODateTimeString
}
