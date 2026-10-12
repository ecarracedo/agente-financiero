/**
 * Market data boundary for the market feature.
 *
 * Reuses the shared typed client for portfolio and transaction reads and adds
 * the analysis and wishlist reads the shared client does not expose yet. All
 * money values stay canonical strings; nothing is coerced to a number here.
 */

import type { PortfolioPosition, TransactionSummary } from '../../api/client'
import { api } from '../../api/client'
import { request } from '../../api/http'
import type { components } from '../../api/types'

/** Market analysis payload from `GET /api/v1/analysis/{ticker}`. */
export type MarketAnalysis = components['schemas']['MarketAnalysisResponse']

/** One wishlist entry from `GET /api/v1/wishlist`. */
export type WishlistItem = components['schemas']['WishlistItemResponse']

/** Periods accepted by the analysis endpoint. */
export const MARKET_PERIODS = ['1mo', '3mo', '6mo', '1y', '2y', '5y'] as const

/** A supported analysis period. */
export type MarketPeriod = (typeof MARKET_PERIODS)[number]

/** Typed read operations used by the market workspace. */
export const marketApi = {
  listPortfolio: (): Promise<PortfolioPosition[]> => api.listPortfolio(),
  listTransactions: (ticker: string, broker: string): Promise<TransactionSummary[]> =>
    api.listTransactions(ticker, broker),
  listWishlist: (): Promise<WishlistItem[]> => request<WishlistItem[]>('/api/v1/wishlist'),
  getAnalysis: (ticker: string, period: MarketPeriod): Promise<MarketAnalysis> =>
    request<MarketAnalysis>(
      `/api/v1/analysis/${encodeURIComponent(ticker)}?period=${encodeURIComponent(period)}`,
    ),
}
