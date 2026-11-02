/**
 * Typed runtime client for the financial agent backend.
 *
 * Wraps the generated OpenAPI contract (`./types`) with concrete request
 * helpers. Monetary and quantity values are canonical strings and are never
 * coerced to numbers by this layer.
 */

import type { paths } from './types'
import { request } from './http'

/** Liveness response from `GET /health`. */
export type HealthResponse =
  paths['/health']['get']['responses'][200]['content']['application/json']

/** Readiness response from `GET /ready`. */
export type ReadyResponse =
  paths['/ready']['get']['responses'][200]['content']['application/json']

/** One portfolio position from `GET /api/v1/portfolio`. */
export type PortfolioPosition =
  paths['/api/v1/portfolio']['get']['responses'][200]['content']['application/json'][number]

/** Raw, currency-keyed valuation payload from `GET /api/v1/valuations`. */
export type ValuationsResponse =
  paths['/api/v1/valuations']['get']['responses'][200]['content']['application/json']

/** One currency-grouped valuation entry. */
export type CurrencyValuation = ValuationsResponse[string]

/** Chronological transaction history from `GET /api/v1/transactions`. */
export type TransactionsResponse =
  paths['/api/v1/transactions']['get']['responses'][200]['content']['application/json']

/** One transaction history entry. */
export type TransactionSummary = TransactionsResponse[number]

/** Body accepted by `POST /api/v1/transactions`. */
export type TransactionRequest =
  paths['/api/v1/transactions']['post']['requestBody']['content']['application/json']

/** Resulting position (or `null`) returned by `POST /api/v1/transactions`. */
export type TransactionCreatedResponse =
  paths['/api/v1/transactions']['post']['responses'][201]['content']['application/json']

/** Delete acknowledgement returned by `DELETE /api/v1/transactions/{id}`. */
export type MutationResponse =
  paths['/api/v1/transactions/{transaction_id}']['delete']['responses'][200]['content']['application/json']

/** Ticker alias list response from `GET /api/v1/ticker-aliases`. */
export type TickerAliasResponse =
  paths['/api/v1/ticker-aliases']['get']['responses'][200]['content']['application/json'][number]

/** Body for creating a ticker alias. */
export type TickerAliasCreateRequest =
  paths['/api/v1/ticker-aliases']['post']['requestBody']['content']['application/json']

/** PPI instrument match from `GET /api/v1/ppi-instruments`. */
export type TickerMatch =
  paths['/api/v1/ppi-instruments']['get']['responses'][200]['content']['application/json'][number]

/** Typed convenience wrappers over the backend contract. */
export const api = {
  health: (): Promise<HealthResponse> => request<HealthResponse>('/health'),
  ready: (): Promise<ReadyResponse> => request<ReadyResponse>('/ready'),
  listPortfolio: (): Promise<PortfolioPosition[]> =>
    request<PortfolioPosition[]>('/api/v1/portfolio'),
  updatePortfolioPosition: (
    ticker: string,
    params: { broker: string; category: string },
    payload: { broker?: string; category?: string },
  ): Promise<PortfolioPosition | null> => {
    const query = new URLSearchParams({ broker: params.broker, category: params.category })
    return request<PortfolioPosition | null>(`/api/v1/portfolio/${ticker}?${query.toString()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },
  /**
   * Fetch currency-grouped valuations.
   *
   * The backend serializes valuations as a currency-keyed object; this helper
   * normalizes that shape into an array so callers can render one group per
   * currency without touching the raw mapping.
   */
  getValuations: async (): Promise<CurrencyValuation[]> =>
    Object.values(await request<ValuationsResponse>('/api/v1/valuations')),
  listTransactions: (ticker: string, broker: string): Promise<TransactionsResponse> => {
    const query = new URLSearchParams({ ticker, broker })
    return request<TransactionsResponse>(`/api/v1/transactions?${query.toString()}`)
  },
  /**
   * Fetch the newest transactions across every asset, newest first.
   *
   * Unlike `listTransactions`, this call names no ticker or broker, so it can
   * power a dashboard widget that shows recent activity for the whole portfolio.
   */
  listRecentTransactions: (limit: number): Promise<TransactionsResponse> =>
    request<TransactionsResponse>(`/api/v1/transactions?limit=${limit}`),
  createTransaction: (payload: TransactionRequest): Promise<TransactionCreatedResponse> =>
    request<TransactionCreatedResponse>('/api/v1/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteTransaction: (transactionId: number): Promise<MutationResponse> =>
    request<MutationResponse>(`/api/v1/transactions/${transactionId}`, {
      method: 'DELETE',
    }),
  listTickerAliases: (): Promise<TickerAliasResponse[]> =>
    request<TickerAliasResponse[]>('/api/v1/ticker-aliases'),
  createTickerAlias: (payload: TickerAliasCreateRequest): Promise<TickerAliasResponse> =>
    request<TickerAliasResponse>('/api/v1/ticker-aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteTickerAlias: (aliasId: number): Promise<MutationResponse> =>
    request<MutationResponse>(`/api/v1/ticker-aliases/${aliasId}`, {
      method: 'DELETE',
    }),
  listPpiInstruments: (): Promise<TickerMatch[]> =>
    request<TickerMatch[]>('/api/v1/ppi-instruments'),
}
