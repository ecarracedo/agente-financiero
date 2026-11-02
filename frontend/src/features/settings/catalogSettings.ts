/**
 * Broker and asset-type catalog, persisted in `localStorage`.
 *
 * The portfolio table and the quick order card both offer these lists, so they
 * read them through this module instead of hardcoding their own copies. The
 * settings workspace edits them.
 */

/** Brokers offered when the user has not customized the catalog. */
export const DEFAULT_BROKERS = ['ECO', 'PPI', 'BINANCE']

/** Asset types offered when the user has not customized the catalog. */
export const DEFAULT_CATEGORIES = ['Acciones', 'Cedear', 'ETF', 'Bono', 'FCI', 'Cripto']

/** Storage key holding the broker catalog. */
export const BROKERS_STORAGE_KEY = 'obsidian.portfolio.brokers'

/** Storage key holding the asset-type catalog. */
export const CATEGORIES_STORAGE_KEY = 'obsidian.portfolio.categories'

/** Event dispatched in the same tab after either catalog is written. */
const CHANGE_EVENT = 'obsidian:portfolio-catalog-changed'

/**
 * Parse a stored JSON list of non-empty, trimmed, unique strings.
 *
 * A malformed entry invalidates the whole stored value instead of being
 * silently dropped, so a corrupted catalog falls back to the defaults rather
 * than shrinking without the user asking.
 */
function parseList(raw: string | null, fallback: string[]): string[] {
  if (raw === null) return fallback
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return fallback
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return fallback
  const values = parsed.filter((entry): entry is string => typeof entry === 'string')
  if (values.length !== parsed.length) return fallback
  const cleaned = values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
  if (cleaned.length === 0) return fallback
  return Array.from(new Set(cleaned))
}

/**
 * Cached read for one storage key.
 *
 * `useSyncExternalStore` requires the same array identity between renders, so
 * the parsed value is memoized. The memo is keyed by the raw stored text, not
 * by "have we read yet": if the value in `localStorage` changes by any other
 * path (another tab, a cleared storage, a test), the next read sees it instead
 * of serving a stale catalog forever.
 */
interface CatalogCache {
  /** Raw stored text the parsed list was derived from. */
  raw: string | null
  /** Parsed list, stable while `raw` does not change. */
  values: string[]
}

/** Memoized reads, keyed by storage key. */
const catalogCache = new Map<string, CatalogCache>()

/** Return the parsed catalog stored under `key`, reusing the memo when possible. */
function readCached(key: string, fallback: string[]): string[] {
  const raw = window.localStorage.getItem(key)
  const cached = catalogCache.get(key)
  if (cached && cached.raw === raw) return cached.values
  const values = parseList(raw, fallback)
  catalogCache.set(key, { raw, values })
  return values
}

/** Return the broker catalog. */
export function readBrokers(): string[] {
  return readCached(BROKERS_STORAGE_KEY, DEFAULT_BROKERS)
}

/** Return the asset-type catalog. */
export function readCategories(): string[] {
  return readCached(CATEGORIES_STORAGE_KEY, DEFAULT_CATEGORIES)
}

/** Persist the broker catalog and notify mounted listeners. */
export function writeBrokers(brokers: string[]): void {
  window.localStorage.setItem(BROKERS_STORAGE_KEY, JSON.stringify(brokers))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Persist the asset-type catalog and notify mounted listeners. */
export function writeCategories(categories: string[]): void {
  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Subscribe to catalog changes from this tab and from other tabs.
 *
 * @returns An unsubscribe function, as required by `useSyncExternalStore`.
 */
export function subscribeCatalog(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
