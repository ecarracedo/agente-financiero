/**
 * Wishlist boundary for the wishlist feature.
 *
 * Wraps the wishlist CRUD endpoints. Tickers and target prices travel as
 * canonical strings and are never coerced to numbers here; the backend owns
 * duplicate detection (409) and missing-item (404) semantics.
 */

import { request } from '../../api/http'
import type { components } from '../../api/types'

/** One wishlist entry with an optional canonical target price. */
export type WishlistItem = components['schemas']['WishlistItemResponse']

/** Acknowledgement returned by a target update. */
export type WishlistTargetUpdated = components['schemas']['UpdatedResponse']

/** Acknowledgement returned by a removal. */
export type WishlistRemoved = components['schemas']['MutationResponse']

/** Build a JSON request init for a write call. */
function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/** Typed wishlist operations used by the wishlist workspace. */
export const wishlistApi = {
  /** List every wishlist entry. */
  list: (): Promise<WishlistItem[]> => request<WishlistItem[]>('/api/v1/wishlist'),
  /** Add a ticker; the backend rejects an already-present ticker with 409. */
  add: (ticker: string): Promise<WishlistItem> =>
    request<WishlistItem>('/api/v1/wishlist', jsonInit('POST', { ticker })),
  /** Set or clear a target price; a missing entry yields 404. */
  setTarget: (ticker: string, targetPrice: string | null): Promise<WishlistTargetUpdated> =>
    request<WishlistTargetUpdated>(
      `/api/v1/wishlist/${encodeURIComponent(ticker)}/target`,
      jsonInit('PUT', { target_price: targetPrice }),
    ),
  /** Remove an entry; a missing entry yields 404. */
  remove: (ticker: string): Promise<WishlistRemoved> =>
    request<WishlistRemoved>(`/api/v1/wishlist/${encodeURIComponent(ticker)}`, {
      method: 'DELETE',
    }),
}
