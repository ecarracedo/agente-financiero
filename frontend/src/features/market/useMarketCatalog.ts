/**
 * Data-fetching hook for the ticker catalog (portfolio holdings + wishlist).
 */

import { useEffect, useState } from 'react'

import { marketApi } from './marketApi'

/** One selectable ticker with the metadata needed for overlays and alerts. */
export interface MarketCatalogEntry {
  ticker: string
  broker: string | null
  category: string | null
  currency: string | null
  targetPrice: string | null
  source: 'portfolio' | 'wishlist'
}

export type MarketCatalogStatus = 'loading' | 'ready' | 'error'

export interface MarketCatalogResult {
  status: MarketCatalogStatus
  entries: MarketCatalogEntry[]
  error: unknown
}

/**
 * Load portfolio holdings and wishlist entries as one ticker catalog.
 *
 * Portfolio holdings come first; wishlist entries that are not already held are
 * appended so a tail alone still resolves to the portfolio position.
 */
export function useMarketCatalog(): MarketCatalogResult {
  const [state, setState] = useState<MarketCatalogResult>({
    status: 'loading',
    entries: [],
    error: null,
  })

  useEffect(() => {
    let active = true

    Promise.all([marketApi.listPortfolio(), marketApi.listWishlist()])
      .then(([positions, wishlist]) => {
        if (!active) return
        const portfolioEntries: MarketCatalogEntry[] = positions.map((position) => ({
          ticker: position.ticker,
          broker: position.broker,
          category: position.category,
          currency: position.currency,
          targetPrice: null,
          source: 'portfolio',
        }))
        const held = new Set(portfolioEntries.map((entry) => entry.ticker))
        const wishlistEntries: MarketCatalogEntry[] = wishlist
          .filter((item) => !held.has(item.ticker))
          .map((item) => ({
            ticker: item.ticker,
            broker: null,
            category: null,
            currency: null,
            targetPrice: item.target_price,
            source: 'wishlist',
          }))
        setState({
          status: 'ready',
          entries: [...portfolioEntries, ...wishlistEntries],
          error: null,
        })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setState({ status: 'error', entries: [], error: caught })
      })

    return () => {
      active = false
    }
  }, [])

  return state
}
