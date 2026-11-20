/**
 * Preference controlling the sound played with global alert popups.
 *
 * The setting lives in `localStorage` and follows the same subscribe/read/write
 * shape as the other terminal preferences, so the toaster and Configuración
 * stay in sync without a shared store or a page reload.
 */

/** Storage key holding whether the alert sound is enabled. */
export const ALERT_SOUND_STORAGE_KEY = 'obsidian.alerts.soundEnabled'

/** Sound is on by default: the user asked for a popup with sound. */
export const DEFAULT_ALERT_SOUND = true

/** Event dispatched in this tab after the preference is written. */
const CHANGE_EVENT = 'obsidian:alert-sound-changed'

/** Read the stored preference, defaulting to enabled when nothing is stored. */
export function readAlertSound(): boolean {
  const stored = window.localStorage.getItem(ALERT_SOUND_STORAGE_KEY)
  if (stored === null) return DEFAULT_ALERT_SOUND
  return stored === 'true'
}

/** Persist the preference and notify mounted listeners. */
export function writeAlertSound(enabled: boolean): void {
  window.localStorage.setItem(ALERT_SOUND_STORAGE_KEY, String(enabled))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Subscribe to preference changes from this tab and from other tabs.
 *
 * @returns An unsubscribe function, as required by `useSyncExternalStore`.
 */
export function subscribeAlertSound(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
