/**
 * Alerts workspace in Obsidian Capital design system.
 *
 * Implements the "Centro de Alertas & Notificaciones" dashboard:
 * - Left column: "Creación de alerta" for portfolio positions or any global
 *   instrument outside the portfolio. Wishlist targets create alerts directly
 *   from the wishlist card, so no wishlist scope is offered here.
 * - Right column: "Configured alerts" monitoring table with scope filtering and
 *   removal actions.
 * - Bottom row: "Triggered alerts" card grid showing recent crossings with
 *   observed tick prices, timestamps, and acknowledge actions.
 */

import { useCallback, useEffect, useState } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState } from '../../components/AsyncStates'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import { TickerSearch } from '../../components/TickerSearch'
import { AlertsPanel } from './AlertsPanel'
import { ConfiguredAlertsTable } from './ConfiguredAlertsTable'
import type { ConfiguredAlert, TriggeredAlertEvent } from './alertApi'
import { alertApi } from './alertApi'
import { alertKey } from './alerts.utils'
import { marketApi } from '../market/marketApi'
import type { PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'

type Scope = 'portfolio' | 'custom'

/** Scopes the backend understands; the UI-only `custom` choice maps to `wishlist`. */
type TargetScope = 'portfolio' | 'wishlist'

/** A selectable alert target: one position or one wishlist entry. */
interface AlertTarget {
  key: string
  ticker: string
  currency: string | null
  broker: string | null
  category: string | null
  scope: TargetScope
}

interface Loaded {
  portfolio: PortfolioPosition[]
  alerts: ConfiguredAlert[]
  events: TriggeredAlertEvent[]
}

/** Compact scope choices shown inside the quick-creation card. */
const SCOPE_OPTIONS: ReadonlyArray<{ value: Scope; label: string }> = [
  { value: 'portfolio', label: 'Cartera' },
  { value: 'custom', label: 'Otro activo' },
]

/** Delay before a selected ticker becomes a live quote request. */
const QUOTE_DEBOUNCE_MS = 400

/** Resolved live quote for one ticker, used to prefill the target price. */
interface LiveQuote {
  ticker: string
  price: string
  currency: string | null
}

export function AlertsWorkspace() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('portfolio')
  const [eventError, setEventError] = useState<string | null>(null)
  const [acknowledging, setAcknowledging] = useState<number | null>(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [customTicker, setCustomTicker] = useState('')
  const [quote, setQuote] = useState<LiveQuote | null>(null)

  const fetchData = useCallback(
    async (): Promise<Loaded> => {
      const [portfolio, alerts, events] = await Promise.all([
        api.listPortfolio(),
        alertApi.list(),
        alertApi.listEvents(),
      ])
      return { portfolio, alerts, events }
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
    ? loaded.portfolio.map((position) => ({
        key: `portfolio:${position.broker}:${position.ticker}`,
        ticker: position.ticker,
        currency: position.currency,
        broker: position.broker,
        category: position.category,
        scope: 'portfolio' as const,
      }))
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

  const selectedTicker = selected?.ticker ?? ''

  // The target-price field starts from the live quote, so the user configures an
  // alert against the current market price instead of an empty input. Debounced
  // to one provider call per settled selection; a failure keeps manual entry.
  useEffect(() => {
    if (selectedTicker === '') return
    let active = true
    const timer = setTimeout(() => {
      marketApi
        .getAnalysis(selectedTicker, '1mo')
        .then((data) => {
          if (!active || data.current_price === null) return
          setQuote({
            ticker: selectedTicker,
            price: data.current_price,
            currency: data.currency,
          })
        })
        .catch(() => {
          // Provider unavailable: the target price stays editable by hand.
        })
    }, QUOTE_DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [selectedTicker])

  function handleScopeChange(next: Scope) {
    setScope(next)
    setQuote(null)
    if (next === 'custom') {
      setSelectedKey('custom')
      setCustomTicker('')
    } else {
      setSelectedKey('')
    }
  }

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
      </div>

      {error !== null ? <ErrorState message={error} /> : null}

      {/* Main 2-Column Grid: Form (col 4-5) & Table (col 7-8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Creación de alerta */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-[#3d494c]/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">notifications</span>
              <h3 className="text-base font-semibold text-white font-headline">Creación de alerta</h3>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-[#869397] uppercase">
                Ámbito
              </span>
              <div
                role="group"
                aria-label="Ámbito"
                className="flex items-center gap-1 bg-[#1c2028] p-1 rounded-lg"
              >
                {SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={scope === option.value}
                    onClick={() => handleScopeChange(option.value)}
                    className={`flex-1 py-1 text-center text-xs font-mono uppercase rounded font-bold transition-all cursor-pointer ${
                      scope === option.value
                        ? 'bg-[#4cd7f6] text-[#003640]'
                        : 'text-[#bcc9cd] hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {scope === 'portfolio' ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="alert-position" className="text-[10px] font-mono text-[#869397] uppercase">
                  Posición de cartera
                </label>
                <select
                  id="alert-position"
                  value={selectedKey}
                  onChange={(event) => setSelectedKey(event.target.value)}
                  className="bg-[#1c2028] px-2.5 py-1.5 rounded-lg border border-[#3d494c]/30 text-xs font-mono text-white focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#181c24] text-white">Seleccionar posición</option>
                  {targets
                    .filter((target) => target.scope === 'portfolio')
                    .map((target) => (
                      <option key={target.key} value={target.key} className="bg-[#181c24] text-white">
                        {target.ticker} — {target.broker ?? ''}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <TickerSearch
                id="alert-ticker-search"
                label="Buscar activo"
                value={customTicker}
                onChange={(value) => setCustomTicker(value.toUpperCase())}
                search={marketApi.searchTickers}
              />
            )}
          </div>

          {selected !== null ? (
            <div className="pt-4 border-t border-[#3d494c]/20">
              <AlertsPanel
                key={selected.key}
                ticker={selected.ticker}
                currency={
                  quote?.ticker === selected.ticker
                    ? quote.currency
                    : selected.currency
                }
                broker={selected.broker}
                category={selected.category}
                scope={selected.scope}
                alert={selectedAlert}
                initialTargetPrice={
                  quote?.ticker === selected.ticker ? quote.price : undefined
                }
                onTargetConfigured={() => {
                  void refresh().catch((cause: unknown) =>
                    setRemoveError(describeApiError(cause)),
                  )
                }}
              />
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-[#1c2028]/40 border border-[#3d494c]/20 text-center text-xs font-mono text-[#869397] flex flex-col gap-1">
              <p className="font-semibold text-white">Sin activo seleccionado</p>
              <p>Elige una posición de la lista o ingresa un ticker libre para fijar su precio objetivo.</p>
            </div>
          )}
        </div>

        {/* Right Column: Monitoreo de Alertas Configuradas */}
        <div className="lg:col-span-7 xl:col-span-8">
          <ConfiguredAlertsTable
            alerts={loaded?.alerts ?? []}
            removing={removing}
            error={removeError}
            onRemove={(alert) => void handleRemove(alert)}
          />
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
              <span>Alertas disparadas</span>
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
                          Disparo: {event.target_price}
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
                      {acknowledging === event.id ? 'Reconociendo…' : 'Reconocer'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {loaded !== null && loaded.events.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">
            No hay alertas disparadas en este momento.
          </p>
        ) : null}
      </section>
    </section>
  )
}
