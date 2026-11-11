/**
 * Alerts workspace: pick a position and manage its target alert.
 *
 * Alerts used to render only inside the market workspace, which meant monitoring
 * an alert required opening the chart first. This workspace owns the selection
 * instead: it lists configured alerts, lists portfolio and wishlist entries, and
 * the chosen entry feeds the shared `AlertsPanel` prefilled with its saved alert.
 */

import { useCallback, useEffect, useState } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import { AlertsPanel } from './AlertsPanel'
import type { ConfiguredAlert } from './alertApi'
import { ALERT_INTENTS, alertApi } from './alertApi'
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
  alerts: ConfiguredAlert[]
}

/** Identify one configured alert across both scopes. */
function alertKey(alert: ConfiguredAlert): string {
  return `${alert.scope}:${alert.ticker}:${alert.broker ?? ''}:${alert.category ?? ''}`
}

/** Describe where a configured alert came from. */
function alertOrigin(alert: ConfiguredAlert): string {
  if (alert.scope === 'wishlist') return 'wishlist'
  return [alert.broker, alert.category].filter(Boolean).join(' · ')
}

/** Display label for a stored trade direction. */
function intentLabel(intent: ConfiguredAlert['intent']): string {
  return ALERT_INTENTS.find((option) => option.value === intent)?.label ?? intent
}

/**
 * Manage target alerts for portfolio and wishlist positions.
 *
 * The workspace lists every configured alert, so monitoring no longer requires
 * opening each target one at a time, and prefills the shared alert panel with
 * the saved target and type instead of starting from an empty form.
 */
export function AlertsWorkspace() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState('')

  const fetchData = useCallback(
    async (): Promise<Loaded> => {
      const [portfolio, wishlist, alerts] = await Promise.all([
        api.listPortfolio(),
        marketApi.listWishlist(),
        alertApi.list(),
      ])
      return { portfolio, wishlist, alerts }
    },
    [],
  )

  const refresh = useCallback(async () => {
    setLoaded(await fetchData())
  }, [fetchData])

  useEffect(() => {
    let active = true
    fetchData()
      .then((next) => {
        if (active) setLoaded(next)
      })
      .catch((cause: unknown) => {
        if (active) setError(describeApiError(cause))
      })
    return () => {
      active = false
    }
  }, [fetchData])

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

  const selectedAlert =
    selected === null
      ? null
      : (loaded?.alerts.find(
          (alert) =>
            alert.scope === selected.scope &&
            alert.ticker === selected.ticker &&
            (selected.scope === 'wishlist' ||
              (alert.broker === selected.broker &&
                alert.category === selected.category)),
        ) ?? null)

  async function handleRemove(alert: ConfiguredAlert) {
    setRemoveError(null)
    setRemoving(alertKey(alert))
    try {
      if (alert.scope === 'portfolio') {
        await alertApi.deletePortfolio(
          alert.ticker,
          alert.broker ?? '',
          alert.category ?? '',
        )
      } else {
        await alertApi.deleteWishlist(alert.ticker)
      }
      await refresh()
    } catch (cause) {
      setRemoveError(describeApiError(cause))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section aria-labelledby="alerts-heading">
      <h2 id="alerts-heading">Alerts</h2>
      <p>Configure a target alert for a portfolio position or a wishlist entry.</p>

      {error !== null ? <ErrorState message={error} /> : null}

      {error === null && loaded === null ? <LoadingState /> : null}

      {error === null && loaded !== null && loaded.alerts.length > 0 ? (
        <section aria-labelledby="configured-alerts-heading">
          <h3 id="configured-alerts-heading">Configured alerts</h3>
          {removeError !== null ? <ErrorState message={removeError} /> : null}
          <ul>
            {loaded.alerts.map((alert) => (
              <li key={alertKey(alert)}>
                <span>
                  {alert.ticker} · {alertOrigin(alert)}
                </span>{' '}
                <span>{intentLabel(alert.intent)}</span>{' '}
                <span>
                  {alert.currency !== null ? (
                    <CurrencyAmount amount={alert.target_price} currency={alert.currency} />
                  ) : (
                    alert.target_price
                  )}
                </span>{' '}
                <button
                  type="button"
                  onClick={() => void handleRemove(alert)}
                  disabled={removing === alertKey(alert)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error === null && loaded !== null && targets.length === 0 ? (
        <p>No positions or wishlist entries are available to configure an alert.</p>
      ) : null}

      {targets.length > 0 ? (
        <>
          <label htmlFor="alert-position">Position</label>
          <select
            id="alert-position"
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
          key={selected.key}
          ticker={selected.ticker}
          currency={selected.currency}
          broker={selected.broker}
          category={selected.category}
          scope={selected.scope}
          alert={selectedAlert}
          onTargetConfigured={() => {
            void refresh().catch((cause: unknown) =>
              setRemoveError(describeApiError(cause)),
            )
          }}
        />
      ) : null}
    </section>
  )
}
