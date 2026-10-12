/**
 * Data-fetching hook for the wishlist collection.
 */

import { useEffect, useState } from 'react'

import type { WishlistItem } from './wishlistApi'
import { wishlistApi } from './wishlistApi'

export type WishlistStatus = 'loading' | 'ready' | 'error'

export interface WishlistResult {
  status: WishlistStatus
  items: WishlistItem[]
  error: unknown
}

/**
 * Load every wishlist entry.
 *
 * State is written from the resolved/rejected request only, so no synchronous
 * state update happens in the effect body.
 *
 * @param refreshToken Counter incremented after a mutation to force a refetch.
 */
export function useWishlist(refreshToken: number): WishlistResult {
  const [state, setState] = useState<WishlistResult>({
    status: 'loading',
    items: [],
    error: null,
  })

  useEffect(() => {
    let active = true

    wishlistApi
      .list()
      .then((items) => {
        if (active) setState({ status: 'ready', items, error: null })
      })
      .catch((caught: unknown) => {
        if (active) setState({ status: 'error', items: [], error: caught })
      })

    return () => {
      active = false
    }
  }, [refreshToken])

  return state
}
