/**
 * Alert boundary for the alerts feature.
 *
 * Wraps the portfolio and wishlist alert endpoints. Request bodies and
 * responses come straight from the generated OpenAPI contract so intents and
 * canonical strings stay aligned with the backend.
 */

import { request } from '../../api/http'
import type { components } from '../../api/types'

/** Trade direction a configured target price is waiting for. */
export type AlertIntent = components['schemas']['AlertIntent']

/** One intent-specific target crossing notification. */
export type TargetAlertEvent = components['schemas']['TargetAlertEventResponse']

/** Alert evaluation response with the canonical observed price. */
export type AlertCheck = components['schemas']['AlertCheckResponse']

/** One configured alert with the identity of the asset it watches. */
export type ConfiguredAlert = components['schemas']['AlertResponse']

/** Body for `PUT /api/v1/portfolio/{ticker}/alert`. */
export type PortfolioAlertBody = components['schemas']['PortfolioAlertRequest']

/** Body for `PUT /api/v1/wishlist/{ticker}/alert`. */
export type WishlistAlertBody = components['schemas']['WishlistAlertRequest']

/** Body for `POST /api/v1/portfolio/{ticker}/alert/check`. */
export type PositionAlertCheckBody = components['schemas']['PositionAlertCheckRequest']

/** Acknowledge a successful alert configuration. */
export type Configured = components['schemas']['ConfiguredResponse']

/** Acknowledge a successful alert removal. */
export type AlertRemoved = components['schemas']['MutationResponse']

/** One persisted crossing, listed so the user can see what fired. */
export type TriggeredAlertEvent = components['schemas']['TriggeredAlertResponse']

/** Response acknowledging that one triggered event was marked as seen. */
export type AcknowledgedResponse = components['schemas']['AcknowledgedResponse']

/** Intent values with their display labels. */
export const ALERT_INTENTS: { value: AlertIntent; label: string }[] = [
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
  list: (): Promise<ConfiguredAlert[]> => request<ConfiguredAlert[]>('/api/v1/alerts'),
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
  deletePortfolio: (
    ticker: string,
    broker: string,
    category: string,
  ): Promise<AlertRemoved> => {
    const query = new URLSearchParams({ broker, category })
    return request<AlertRemoved>(
      `/api/v1/portfolio/${encodeURIComponent(ticker)}/alert?${query.toString()}`,
      { method: 'DELETE' },
    )
  },
  deleteWishlist: (ticker: string): Promise<AlertRemoved> =>
    request<AlertRemoved>(`/api/v1/wishlist/${encodeURIComponent(ticker)}/alert`, {
      method: 'DELETE',
    }),
  listEvents: (includeAcknowledged = false): Promise<TriggeredAlertEvent[]> =>
    request(
      `/api/v1/alerts/events${includeAcknowledged ? '?include_acknowledged=true' : ''}`,
    ),
  acknowledgeEvent: (eventId: number): Promise<AcknowledgedResponse> =>
    request(`/api/v1/alerts/events/${eventId}/acknowledge`, { method: 'POST' }),
  evaluate: (): Promise<TriggeredAlertEvent[]> =>
    request('/api/v1/alerts/evaluate', { method: 'POST' }),
}
