/**
 * Format a date as a local wall-clock value for a `datetime-local` input.
 *
 * The timezone offset is applied before ISO serialization so the returned
 * value represents the browser's local time instead of a UTC timestamp. The
 * optional date makes formatting deterministic for callers and tests.
 */
export function localDateTimeValue(date: Date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}
