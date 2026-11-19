/**
 * Alerts workspace in Obsidian Capital design system.
 *
 * Implements the "Centro de Alertas & Notificaciones" dashboard:
 * - Left column: "Creación Rápida de Alerta" for portfolio positions, wishlist
 *   items, or any global instrument outside the portfolio.
 * - Right column: "Configured alerts" monitoring table with scope filtering and
 *   removal actions.
 * - Bottom row: "Triggered alerts" card grid showing recent crossings with
 *   observed tick prices, timestamps, and acknowledge actions.
 */

import { useCallback, useEffect, useState } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import { AlertsPanel } from './AlertsPanel'
import type { ConfiguredAlert, TriggeredAlertEvent } from './alertApi'
import { ALERT_INTENTS, alertApi } from './alertApi'
import { marketApi } from '../market/marketApi'
import type { WishlistItem } from '../market/marketApi'
import type { PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'

type Scope = 'portfolio' | 'wishlist' | 'custom'

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
  events: TriggeredAlertEvent[]
}

type TabFilter = 'all' | 'portfolio' | 'wishlist'

/** Identify one configured alert across both scopes. */
function alertKey(alert: ConfiguredAlert): string {
  return `${alert.scope}:${alert.ticker}:${alert.broker ?? ''}:${alert.category ?? ''}`
}

/** Describe where a configured alert came from. */
function alertOrigin(alert: ConfiguredAlert): string {
  if (alert.scope === 'wishlist') return 'wishlist'
  return [alert.broker, alert.category].filter(Boolean).join(' · ')
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

/** Render the scope selector at the top of the workspace. */
function ScopeSelector({
  scope,
  setScope,
  selectedKey,
  setSelectedKey,
  targets,
}: {
  scope: Scope
  setScope: (s: Scope) => void
  selectedKey: string
  setSelectedKey: (s: string) => void
  targets: AlertTarget[]
}) {
  const portfolioTargets = targets.filter((t) => t.scope === 'portfolio')
  const wishlistTargets = targets.filter((t) => t.scope === 'wishlist')

  return (
    <div className="mb-4">
      <label htmlFor="scope-selector" className="text-xs font-mono uppercase tracking-wider text-on-surface-variant block mb-2">
        Scope
      </label>
      <select id="scope-selector"
        value={scope}
        onChange={(e) => {
          const newScope = e.target.value as Scope
          setScope(newScope)
          if (newScope === 'portfolio') {
            setSelectedKey(
              portfolioTargets.length > 0 ? portfolioTargets[0].key : ''
            )
          } else if (newScope === 'wishlist') {
            setSelectedKey(
              wishlistTargets.length > 0 ? wishlistTargets[0].key : ''
            )
          } else {
            setSelectedKey('')
          }
        }}
        className="w-full py-2.5 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
      >
        <option value="portfolio">Cartera</option>
        <option value="wishlist">Wishlist</option>
        <option value="custom">Otro activo</option>
      </select>
    </div>
  )
}

export function AlertsWorkspace() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [eventsChecking, setEventsChecking] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [acknowledging, setAcknowledging] = useState<number | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [customTicker, setCustomTicker] = useState('')
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [searchFilter, setSearchFilter] = useState('')

  const fetchData = useCallback(
    async (): Promise<Loaded> => {
      const [portfolio, wishlist, alerts, events] = await Promise.all([
        api.listPortfolio(),
        marketApi.listWishlist(),
        alertApi.list(),
        alertApi.listEvents(),
      ])
      return { portfolio, wishlist, alerts, events }
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

  async function handleCheckNow() {
    setEventError(null)
    setEventsChecking(true)
    try {
      await alertApi.evaluate()
      const events = await alertApi.listEvents()
      setLoaded((previous) => previous && { ...previous, events })
    } catch (cause) {
      setEventError(describeApiError(cause))
    } finally {
      setEventsChecking(false)
    }
  }

  async function handleAcknowledge(event: TriggeredAlertEvent) {
    setEventError(null)
    setAcknowledging(event.id)
    try {
      await alertApi.acknowledgeEvent(event.id)
      const events = await alertApi.listEvents()
      setLoaded((previous) => previous && { ...previous, events })
    } catch (cause) {
      setEventError(describeApiError(cause))
    } finally {
      setAcknowledging(null)
    }
  }

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
          currency: null,
          broker: null,
          category: null,
          scope: 'wishlist' as const,
        })),
      ]
    : []

  const isCustom = selectedKey === 'custom'
  const customTarget: AlertTarget | null =
    isCustom && customTicker.trim() !== ''
      ? {
          key: `custom:${customTicker.trim().toUpperCase()}`,
          ticker: customTicker.trim().toUpperCase(),
          currency: null,
          broker: null,
          category: null,
          scope: 'wishlist',
        }
      : null

  const selected = isCustom
    ? customTarget
    : (targets.find((target) => target.key === selectedKey) ?? null)

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

  const filteredAlerts = (loaded?.alerts ?? []).filter((alert) => {
    if (tabFilter === 'portfolio' && alert.scope !== 'portfolio') return false
    if (tabFilter === 'wishlist' && alert.scope !== 'wishlist') return false
    if (searchFilter.trim() !== '') {
      const q = searchFilter.toLowerCase()
      return (
        alert.ticker.toLowerCase().includes(q) ||
        (alert.broker ?? '').toLowerCase().includes(q) ||
        (alert.category ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const portfolioCount = (loaded?.alerts ?? []).filter((a) => a.scope === 'portfolio').length
  const wishlistCount = (loaded?.alerts ?? []).filter((a) => a.scope === 'wishlist').length

  return (
    <section aria-labelledby="alerts-heading" className="space-y-6">
      {/* Top Hero Header: Obsidian Capital Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low/70 backdrop-blur-md p-6 rounded-xl border border-outline-variant/30 shadow-lg relative overflow-hidden">
        <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="space-y-1">
          <h2 id="alerts-heading" className="text-2xl font-bold tracking-tight text-on-surface">
            Centro de Alertas &amp; Notificaciones
          </h2>
          <p className="text-sm text-on-surface-variant">
            Monitoreo de cartera, wishlist y activos globales en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void handleCheckNow()}
            disabled={eventsChecking}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-semibold text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_0_28px_rgba(6,182,212,0.55)] cursor-pointer disabled:opacity-50"
          >
            <span className="text-base font-bold">⚡</span>
            <span>{eventsChecking ? 'Evaluando…' : 'Check now'}</span>
          </button>
        </div>
      </div>

      {error !== null ? <ErrorState message={error} /> : null}
      {error === null && loaded === null ? <LoadingState /> : null}

      {/* Scope Selector Row */}
      <div className="mb-4">
        <ScopeSelector
          scope={scope}
          setScope={setScope}
          selectedKey={selectedKey}
          setSelectedKey={setSelectedKey}
          targets={targets}
        />
      </div>

      {/* Main 2-Column Grid: Form (col 4-5) & Table (col 7-8) */}
      {error === null && loaded === null ? <LoadingState /> : null}

      {/* Main 2-Column Grid: Form (col 4-5) & Table (col 7-8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Creación Rápida de Alerta */}
        <div className="lg:col-span-5 xl:col-span-4 bg-surface-container-low/95 backdrop-blur-md p-6 rounded-xl shadow-xl flex flex-col gap-4 border border-outline-variant/35 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/25">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                🔔
              </div>
              <h3 className="text-base font-semibold text-on-surface">Creación Rápida de Alerta</h3>
            </div>
            <span className="text-[11px] font-mono text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
              Configurador
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="alert-position" className="text-xs font-mono uppercase tracking-wider text-on-surface-variant block mb-1">
                Position
              </label>
              <select
                id="alert-position"
                value={selectedKey}
                onChange={(event) => setSelectedKey(event.target.value)}
                className="w-full py-2.5 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">Select a position</option>
                <optgroup label="Cartera">
                  {targets
                    .filter((t) => t.scope === 'portfolio')
                    .map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.ticker} — {target.broker ?? ''}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Wishlist">
                  {targets
                    .filter((t) => t.scope === 'wishlist')
                    .map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.ticker} — wishlist
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Activo Fuera de Cartera">
                  <option value="custom">+ Ingresar otro activo (fuera de cartera)...</option>
                </optgroup>
              </select>
            </div>

            {isCustom ? (
              <div className="space-y-1">
                <label htmlFor="custom-ticker-input" className="text-xs font-mono uppercase tracking-wider text-on-surface-variant block">
                  Ticker del instrumento
                </label>
                <input
                  id="custom-ticker-input"
                  type="text"
                  placeholder="Ej: TSLA, BTC-USD, S13N6..."
                  value={customTicker}
                  onChange={(e) => setCustomTicker(e.target.value.toUpperCase())}
                  className="w-full py-2 px-3 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30 text-sm uppercase font-mono focus:outline-none focus:border-primary transition-colors"
                />
                <span className="text-[11px] text-outline block">
                  Se agregará al wishlist y se evaluará automáticamente por el scheduler.
                </span>
              </div>
            ) : null}
          </div>

          {selected !== null ? (
            <div className="pt-2 border-t border-outline-variant/20">
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
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-surface-container/40 border border-outline-variant/20 text-center text-xs text-on-surface-variant space-y-1">
              <p className="font-semibold text-on-surface">Sin activo seleccionado</p>
              <p>Elige una posición de la lista o ingresa un ticker libre para fijar su precio objetivo.</p>
            </div>
          )}
        </div>

        {/* Right Column: Monitoreo de Alertas Configuradas */}
        <div className="lg:col-span-7 xl:col-span-8 bg-surface-container-low/95 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-outline-variant/35 flex flex-col">
          {/* Toolbar and Tabs */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest/60 border-b border-outline-variant/20">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setTabFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tabFilter === 'all'
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                <span>Todas</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {loaded?.alerts.length ?? 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('portfolio')}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tabFilter === 'portfolio'
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                <span>Cartera</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {portfolioCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTabFilter('wishlist')}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  tabFilter === 'wishlist'
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                <span>Wishlist</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {wishlistCount}
                </span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar alertas o ticker..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full sm:w-56 pl-3 pr-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs border border-outline-variant/30 focus:outline-none focus:border-primary transition-colors placeholder:text-outline"
              />
            </div>
          </div>

          <section aria-labelledby="configured-alerts-heading" className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 id="configured-alerts-heading" className="text-base font-semibold text-on-surface">
                Configured alerts
              </h3>
              <span className="text-xs text-outline font-mono">
                {filteredAlerts.length} de {loaded?.alerts.length ?? 0} alertas
              </span>
            </div>

            {removeError !== null ? <ErrorState message={removeError} /> : null}

            {filteredAlerts.length > 0 ? (
              <ul className="divide-y divide-outline-variant/20 rounded-lg overflow-hidden border border-outline-variant/20 bg-surface-container/20">
                {filteredAlerts.map((alert) => {
                  const isBuy = alert.intent === 'BUY'
                  return (
                    <li
                      key={alertKey(alert)}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold font-mono text-sm border ${
                            alert.scope === 'portfolio'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-secondary/10 text-secondary border-secondary/20'
                          }`}
                        >
                          {alert.ticker.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-on-surface font-mono">
                              {alert.ticker} · {alertOrigin(alert)}
                            </span>
                          </div>
                          <span
                            className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded mt-0.5 ${
                              isBuy
                                ? 'bg-secondary/15 text-secondary border border-secondary/25'
                                : 'bg-primary/15 text-primary border border-primary/25'
                            }`}
                          >
                            <span>{intentLabel(alert.intent)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-[11px] text-outline font-mono uppercase block">
                            Objetivo
                          </span>
                          <span className="font-mono text-sm font-semibold text-on-surface">
                            {alert.currency !== null ? (
                              <CurrencyAmount amount={alert.target_price} currency={alert.currency} />
                            ) : (
                              alert.target_price
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleRemove(alert)}
                          disabled={removing === alertKey(alert)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-error hover:bg-error/10 border border-error/30 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {removing === alertKey(alert) ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-on-surface-variant py-8 text-center bg-surface-container/20 rounded-lg border border-outline-variant/10">
                No configured alerts matching this filter.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Bottom Full-Width Section: Registro Histórico de Disparos Recientes */}
      <section
        aria-labelledby="triggered-alerts-heading"
        className="bg-surface-container-low/95 backdrop-blur-md p-6 rounded-xl border border-outline-variant/35 shadow-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-outline-variant/25">
          <div className="space-y-0.5">
            <h3 id="triggered-alerts-heading" className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span>Triggered alerts</span>
              <span className="text-xs font-normal text-on-surface-variant font-mono">
                / Registro Histórico de Disparos Recientes
              </span>
            </h3>
            <span className="text-xs text-on-surface-variant font-mono block">
              Auditoría en tiempo real con latencia de entrega tick-by-tick
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-secondary flex items-center gap-1.5 bg-secondary/10 px-2.5 py-1 rounded border border-secondary/20">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" /> Feed Activo (300s)
            </span>
          </div>
        </div>

        {eventError !== null ? <ErrorState message={eventError} /> : null}

        {loaded !== null && loaded.events.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loaded.events.map((event) => {
              const isBuy = event.intent === 'BUY'
              return (
                <li
                  key={event.id}
                  className="bg-surface-container p-4 rounded-xl border border-outline-variant/30 flex flex-col justify-between space-y-3 group hover:border-outline-variant/60 transition-colors shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border ${
                          isBuy
                            ? 'bg-secondary/15 text-secondary border-secondary/25'
                            : 'bg-primary/15 text-primary border-primary/25'
                        }`}
                      >
                        ⚡
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm text-on-surface">
                            ${event.ticker}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                              isBuy
                                ? 'bg-secondary/10 text-secondary border-secondary/20'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                          >
                            {isBuy ? 'Compra' : 'Venta'}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-outline block mt-0.5">
                          Trigger: {event.target_price}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-on-surface-variant bg-surface-container-lowest/60 px-2 py-0.5 rounded border border-outline-variant/20">
                      {new Date(event.triggered_at).toLocaleTimeString('es-AR')}
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {event.ticker} · {event.message}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                    <span className="text-outline font-mono">
                      Ejecutado:{' '}
                      <strong className="text-on-surface">
                        {event.currency !== null ? (
                          <CurrencyAmount amount={event.observed_price} currency={event.currency} />
                        ) : (
                          event.observed_price
                        )}
                      </strong>
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleAcknowledge(event)}
                      disabled={acknowledging === event.id}
                      className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-primary-container hover:text-on-primary text-primary font-mono text-xs font-semibold transition-all border border-primary/25 cursor-pointer disabled:opacity-50"
                    >
                      {acknowledging === event.id ? 'Reconociendo…' : 'Acknowledge'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {loaded !== null && loaded.events.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">
            No triggered alerts right now.
          </p>
        ) : null}
      </section>
    </section>
  )
}
