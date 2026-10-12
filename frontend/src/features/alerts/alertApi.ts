/**
 * Alert boundary for the alerts feature.
 *
 * Wraps the portfolio and wishlist alert endpoints. Request bodies and
 * responses come straight from the generated OpenAPI contract so intents and
 * canonical strings stay aligned with the backend.
 */

import { request } from '../../api/http'
import type { components } from '../../api/types'

/** Supported meanings for a configured target price. */
export type AlertIntent = components['schemas']['AlertIntent']

/** One intent-specific target crossing notification. */
export type TargetAlertEvent = components['schemas']['TargetAlertEventResponse']

/** Alert evaluation response with the canonical observed price. */
export type AlertCheck = components['schemas']['AlertCheckResponse']

/** Body for `PUT /api/v1/portfolio/{ticker}/alert`. */
export type PortfolioAlertBody = components['schemas']['PortfolioAlertRequest']

/** Body for `PUT /api/v1/wishlist/{ticker}/alert`. */
export type WishlistAlertBody = components['schemas']['WishlistAlertRequest']

/** Body for `POST /api/v1/portfolio/{ticker}/alert/check`. */
export type PositionAlertCheckBody = components['schemas']['PositionAlertCheckRequest']

/** Acknowledge a successful alert configuration. */
export type Configured = components['schemas']['ConfiguredResponse']

/** Intent values with their display labels. */
export const ALERT_INTENTS: { value: AlertIntent; label: string }[] = [
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'STOP_LOSS', label: 'Stop-loss' },
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
]

/** Build a JSON request init for a write call. */
function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/** Typed alert operations used by the alerts workspace. */
export const alertApi = {
  configurePortfolio: (
    ticker: string,
    body: PortfolioAlertBody,
  ): Promise<Configured> =>
    request<Configured>(
      `/api/v1/portfolio/${encodeURIComponent(ticker)}/alert`,
      jsonInit('PUT', body),
    ),
  checkPortfolio: (
    ticker: string,
    body: PositionAlertCheckBody,
  ): Promise<AlertCheck> =>
    request<AlertCheck>(
      `/api/v1/portfolio/${encodeURIComponent(ticker)}/alert/check`,
      jsonInit('POST', body),
    ),
  configureWishlist: (ticker: string, body: WishlistAlertBody): Promise<Configured> =>
    request<Configured>(
      `/api/v1/wishlist/${encodeURIComponent(ticker)}/alert`,
      jsonInit('PUT', body),
    ),
  checkWishlist: (ticker: string): Promise<AlertCheck> =>
    request<AlertCheck>(
      `/api/v1/wishlist/${encodeURIComponent(ticker)}/alert/check`,
      { method: 'POST' },
    ),
}
