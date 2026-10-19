/**
 * Alerts workspace: pick a position and manage its target alert.
 *
 * Alerts used to render only inside the market workspace, which meant monitoring
 * an alert required opening the chart first. This workspace owns the selection
 * instead: it lists portfolio and wishlist entries, and the chosen entry feeds
 * the shared `AlertsPanel`.
 */

import { useEffect, useState } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { AlertsPanel } from './AlertsPanel'
import { marketApi } from '../market/marketApi'
import type { WishlistItem } from '../market/marketApi'
import type { PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'

type Scope = 'portfolio' | 'wishlist'

/** A selectable alert target: one position or one wishlist entry. */
interface AlertTarget {
  key: string
  ticker: string
  currency: string | null
  broker: string | null
  category: string | null
  scope: Scope
}

interface Loaded {
  portfolio: PortfolioPosition[]
  wishlist: WishlistItem[]
}

/**
 * Manage target alerts for portfolio and wishlist positions.
 *
 * The workspace lists every eligible target and renders the shared alert panel
 * for the selected one, so alerts are reachable without the market workspace.
 */
export function AlertsWorkspace() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api.listPortfolio(), marketApi.listWishlist()])
      .then(([portfolio, wishlist]) => {
        if (active) setLoaded({ portfolio, wishlist })
      })
      .catch((cause: unknown) => {
        if (active) setError(describeApiError(cause))
      })
    return () => {
      active = false
    }
  }, [])

  const targets: AlertTarget[] = loaded
    ? [
        ...loaded.portfolio.map((position) => ({
          key: `portfolio:${position.broker}:${position.ticker}`,
          ticker: position.ticker,
          currency: position.currency,
          broker: position.broker,
          category: position.category,
          scope: 'portfolio' as const,
        })),
        ...loaded.wishlist.map((item) => ({
          key: `wishlist:${item.ticker}`,
          ticker: item.ticker,
          // Wishlist entries carry no currency; the alert panel renders the
          // target without one rather than inventing a default.
          currency: null,
          broker: null,
          category: null,
          scope: 'wishlist' as const,
        })),
      ]
    : []

  const selected = targets.find((target) => target.key === selectedKey) ?? null

  return (
    <section aria-labelledby="alerts-heading">
      <h2 id="alerts-heading">Alerts</h2>
      <p>Configure a target alert for a portfolio position or a wishlist entry.</p>

      {error !== null ? <ErrorState message={error} /> : null}

      {error === null && loaded === null ? <LoadingState /> : null}

      {error === null && loaded !== null && targets.length === 0 ? (
        <p>No positions or wishlist entries are available to configure an alert.</p>
      ) : null}

      {targets.length > 0 ? (
        <>
          <label htmlFor="alert-target">Position</label>
          <select
            id="alert-target"
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            <option value="">Select a position</option>
            {targets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.scope === 'portfolio'
                  ? `${target.ticker} — ${target.broker ?? ''}`
                  : `${target.ticker} — wishlist`}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {selected !== null ? (
        <AlertsPanel
          ticker={selected.ticker}
          currency={selected.currency}
          broker={selected.broker}
          category={selected.category}
          scope={selected.scope}
        />
      ) : null}
    </section>
  )
}
