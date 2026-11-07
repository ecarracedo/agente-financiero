/**
 * Date helpers shared by the transaction entry points.
 */

/**
 * Format a date as a local `datetime-local` value (`YYYY-MM-DDTHH:mm`).
 *
 * The backend accepts this shape for `occurred_at`; using local time keeps the
 * value the user sees in the form identical to the value that is recorded.
 */
export function localDateTimeValue(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
