/**
 * Ticker tape symbols, persisted in `localStorage`.
 *
 * The header tape and the settings workspace share this module, following the
 * catalog settings pattern: a memoized read for `useSyncExternalStore`, a
 * write that notifies mounted listeners, and a subscription covering both
 * this tab and other tabs.
 */

/** Storage key holding the tape symbols. */
export const TAPE_STORAGE_KEY = 'obsidian.ticker-tape.symbols'

/** Symbols shown before the user configures any. */
export const DEFAULT_TAPE_SYMBOLS = ['^GSPC', '^IXIC', 'BTC-USD']

const LABELS: Record<string, string> = {
  '^GSPC': 'SPX',
  '^IXIC': 'NDX',
  'BTC-USD': 'BTC/USD',
}

/** Display label for a tape symbol. */
export function tapeLabel(symbol: string): string {
  return LABELS[symbol] ?? symbol
}

/** Event dispatched in the same tab after the tape symbols are written. */
const CHANGE_EVENT = 'obsidian:ticker-tape-changed'

interface TapeCache {
  /** Raw stored text the parsed list was derived from. */
  raw: string | null
  /** Parsed list, stable while `raw` does not change. */
  values: string[]
}

let tapeCache: TapeCache | null = null

/** Return the configured tape symbols, reusing the memo when possible. */
export function readTapeSymbols(): string[] {
  const raw = window.localStorage.getItem(TAPE_STORAGE_KEY)
  if (tapeCache && tapeCache.raw === raw) return tapeCache.values
  let values = DEFAULT_TAPE_SYMBOLS
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((s): s is string => typeof s === 'string')) {
        const cleaned = Array.from(new Set(parsed.map((s) => s.trim()).filter(Boolean)))
        if (cleaned.length) values = cleaned
      }
    } catch {
      // fall through to the defaults
    }
  }
  tapeCache = { raw, values }
  return values
}

/** Persist the tape symbols and notify mounted listeners. */
export function writeTapeSymbols(symbols: string[]): void {
  const cleaned = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)))
  if (!cleaned.length) return
  window.localStorage.setItem(TAPE_STORAGE_KEY, JSON.stringify(cleaned))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Subscribe to tape symbol changes from this tab and from other tabs.
 *
 * @returns An unsubscribe function, as required by `useSyncExternalStore`.
 */
export function subscribeTapeSymbols(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
