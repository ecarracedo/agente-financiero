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
 * Return the stored broker list.
 *
 * The snapshot is cached so `useSyncExternalStore` receives the same array
 * identity between renders; a fresh array on every call would loop forever.
 */
let brokersSnapshot: string[] | null = null

/** Return the broker catalog. */
export function readBrokers(): string[] {
  if (brokersSnapshot === null) {
    brokersSnapshot = parseList(
      window.localStorage.getItem(BROKERS_STORAGE_KEY),
      DEFAULT_BROKERS,
    )
  }
  return brokersSnapshot
}

/** Return the asset-type catalog, cached for the same reason as `readBrokers`. */
let categoriesSnapshot: string[] | null = null

/** Return the asset-type catalog. */
export function readCategories(): string[] {
  if (categoriesSnapshot === null) {
    categoriesSnapshot = parseList(
      window.localStorage.getItem(CATEGORIES_STORAGE_KEY),
      DEFAULT_CATEGORIES,
    )
  }
  return categoriesSnapshot
}

/** Persist the broker catalog and notify mounted listeners. */
export function writeBrokers(brokers: string[]): void {
  window.localStorage.setItem(BROKERS_STORAGE_KEY, JSON.stringify(brokers))
  brokersSnapshot = null
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Persist the asset-type catalog and notify mounted listeners. */
export function writeCategories(categories: string[]): void {
  window.localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories))
  categoriesSnapshot = null
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
