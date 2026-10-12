/**
 * Typed runtime client for the financial agent backend.
 *
 * Wraps the generated OpenAPI contract (`./types`) with concrete request
 * helpers. New endpoints for portfolio, transactions, valuations, and alerts
 * are added here as the features land.
 */

import type { paths } from './types'
import { request } from './http'

/** Liveness response from `GET /health`. */
export type HealthResponse =
  paths['/health']['get']['responses'][200]['content']['application/json']

/** Readiness response from `GET /ready`. */
export type ReadyResponse =
  paths['/ready']['get']['responses'][200]['content']['application/json']

/** Portfolio positions response from `GET /api/v1/portfolio`. */
export type PortfolioResponse =
  paths['/api/v1/portfolio']['get']['responses'][200]['content']['application/json']

/** Currency-grouped valuation response from `GET /api/v1/valuations`. */
export type ValuationsResponse =
  paths['/api/v1/valuations']['get']['responses'][200]['content']['application/json']

/** Typed convenience wrappers over the backend contract. */
export const api = {
  health: (): Promise<HealthResponse> => request<HealthResponse>('/health'),
  ready: (): Promise<ReadyResponse> => request<ReadyResponse>('/ready'),
  listPortfolio: (): Promise<PortfolioResponse> =>
    request<PortfolioResponse>('/api/v1/portfolio'),
  getValuations: (): Promise<ValuationsResponse> =>
    request<ValuationsResponse>('/api/v1/valuations'),
}
