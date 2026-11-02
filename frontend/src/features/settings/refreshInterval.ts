/**
 * Portfolio quote refresh interval, persisted in `localStorage`.
 *
 * The setting is shared by the portfolio holdings table (which polls quotes)
 * and the settings workspace (which edits it), so both read and write through
 * this module instead of duplicating the storage key. A custom event keeps any
 * already-mounted table in sync without a page reload, and the `storage` event
 * covers a change made in another tab.
 */

/** Storage key holding the interval in minutes. */
export const REFRESH_INTERVAL_STORAGE_KEY = 'obsidian.portfolio.refreshMinutes'

/** Interval used when nothing valid has been stored yet. */
export const DEFAULT_REFRESH_MINUTES = 5

/** Intervals offered in the settings workspace, in minutes. */
export const REFRESH_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30] as const

/** Event dispatched in the same tab after the interval is written. */
const CHANGE_EVENT = 'obsidian:portfolio-refresh-changed'

/**
 * Return the stored interval, falling back to the default when it is missing,
 * unparseable, or not one of the offered options.
 */
export function readRefreshMinutes(): number {
  const stored = window.localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY)
  const parsed = stored === null ? Number.NaN : Number(stored)
  const allowed: readonly number[] = REFRESH_INTERVAL_OPTIONS
  return allowed.includes(parsed) ? parsed : DEFAULT_REFRESH_MINUTES
}

/**
 * Persist a new interval and notify mounted listeners.
 *
 * Writing always dispatches the change event, even when the value is
 * unchanged, so an explicit choice in settings still reaches every subscriber.
 */
export function writeRefreshMinutes(minutes: number): void {
  window.localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(minutes))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Subscribe to interval changes from this tab and from other tabs.
 *
 * @returns An unsubscribe function, as required by `useSyncExternalStore`.
 */
export function subscribeRefreshMinutes(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
