/**
 * Holdings table for the portfolio workspace.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'

import type { PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import { marketApi } from '../market/marketApi'
import { readBrokers, readCategories, subscribeCatalog } from '../settings/catalogSettings'
import {
  DEFAULT_REFRESH_MINUTES,
  readRefreshMinutes,
  subscribeRefreshMinutes,
} from '../settings/refreshInterval'
import { AutoRefreshTimer } from './AutoRefreshTimer'

/** Ticker alias from the API. */
interface TickerAlias {
  id: number
  broker_ticker: string
  official_name: string
  provider: string
}

/** Mutable fields a user can change on an existing position. */
type PositionPatch = { broker?: string; category?: string }

/** Identify one row so an in-flight edit can be shown before the reload lands. */
function positionKey(position: PortfolioPosition): string {
  return `${position.ticker}|${position.broker}|${position.category}`
}

/**
 * Return `values` with `current` guaranteed to be present.
 *
 * A stored position can hold a broker or asset type the catalog no longer
 * offers: the catalog is user-editable and older rows predate it. A `<select>`
 * whose `value` matches no `option` renders empty, so the current value is
 * prepended instead of silently disappearing.
 */
function withCurrent(values: string[], current: string): string[] {
  return values.includes(current) ? values : [current, ...values]
}

type QuoteState = {
  price: string | null
  status: 'loading' | 'ready' | 'error'
}

function VariationCell({ position, currentPrice }: { position: PortfolioPosition; currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-xs text-[#869397]">—</span>
  const avg = Number(position.average_price)
  const cur = Number(currentPrice)
  if (!Number.isFinite(avg) || avg === 0 || !Number.isFinite(cur)) {
    return <span className="font-mono text-xs text-[#869397]">—</span>
  }
  const pct = ((cur - avg) / avg) * 100
  const isPositive = pct >= 0
  return (
    <span className={`font-mono text-xs ${isPositive ? 'text-[#46fa9c]' : 'text-[#ff7f8b]'}`}>
      {isPositive ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  )
}

function PnLCell({ position, currentPrice }: { position: PortfolioPosition; currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-xs text-[#869397]">—</span>
  const qty = Number(position.quantity)
  const avg = Number(position.average_price)
  const cur = Number(currentPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(avg) || !Number.isFinite(cur)) {
    return <span className="font-mono text-xs text-[#869397]">—</span>
  }
  const pnl = (cur - avg) * qty
  const isPositive = pnl >= 0
  const formatted = Math.abs(pnl).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className={`font-mono text-xs ${isPositive ? 'text-[#46fa9c]' : 'text-[#ff7f8b]'}`}>
      {isPositive ? '+' : '-'}$ {formatted}
    </span>
  )
}



function TotalCell({ position, currentPrice }: { position: PortfolioPosition; currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-xs text-[#869397]">—</span>
  const qty = Number(position.quantity)
  const cur = Number(currentPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(cur)) return <span className="font-mono text-xs text-[#869397]">—</span>
  const total = qty * cur
  const formatted = total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className="font-mono text-xs text-white">
      $ {formatted} <span className="text-[#869397]">{position.currency}</span>
    </span>
  )
}

function PriceCell({ amount }: { amount: string }) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return <span className="font-mono text-xs text-[#869397]">—</span>
  const formatted = num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span className="font-mono text-xs text-white">$ {formatted}</span>
}

function CurrentPriceCell({ currentPrice }: { currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-xs text-[#869397]">—</span>
  const num = Number(currentPrice)
  if (!Number.isFinite(num)) return <span className="font-mono text-xs text-[#869397]">—</span>
  const formatted = num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span className="font-mono text-xs text-white">$ {formatted}</span>
}

function makeColumns(
  getQuote: (ticker: string) => QuoteState,
  onSellAll: (position: PortfolioPosition, price: string) => void,
  sellingTicker: string | null,
  onUpdate: (position: PortfolioPosition, payload: PositionPatch) => void,
  brokers: string[],
  categories: string[],
  drafts: Record<string, PositionPatch>,
  displayTicker: (ticker: string) => string,
): Column<PortfolioPosition>[] {
  return [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (position) => (
        <span className="font-bold text-xs text-white font-mono">
          {displayTicker(position.ticker)}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Activo',
      render: (position) => {
        const selected = drafts[positionKey(position)]?.category ?? position.category
        return (
          <select
            value={selected}
            onChange={(e) => {
              e.stopPropagation()
              onUpdate(position, { category: e.target.value })
            }}
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/10 text-[10px] font-medium text-[#4cd7f6] border border-[#4cd7f6]/30"
          >
            {withCurrent(categories, selected).map((c) => (
              <option key={c} value={c} className="bg-[#181c24] text-[#dfe2ee]">
                {c}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'center',
      render: (position) => (
        <span className="font-mono text-xs text-white">{Number(position.quantity).toLocaleString('es-AR', { maximumFractionDigits: 6 })}</span>
      ),
    },
    {
      key: 'average_price',
      header: 'Ponderado',
      align: 'center',
      render: (position) => <PriceCell amount={position.average_price} />,
    },
    {
      key: 'current_price',
      header: 'Actual',
      align: 'center',
      render: (position) => <CurrentPriceCell currentPrice={getQuote(position.ticker).price} />,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'center',
      render: (position) => <TotalCell position={position} currentPrice={getQuote(position.ticker).price} />,
    },
    {
      key: 'variation',
      header: 'Variación',
      align: 'center',
      render: (position) => <VariationCell position={position} currentPrice={getQuote(position.ticker).price} />,
    },
    {
      key: 'pnl',
      header: 'P&L',
      align: 'center',
      render: (position) => <PnLCell position={position} currentPrice={getQuote(position.ticker).price} />,
    },
    {
      key: 'broker',
      header: 'Broker',
      render: (position) => {
        const selected = drafts[positionKey(position)]?.broker ?? position.broker
        return (
          <select
            value={selected}
            onChange={(e) => {
              e.stopPropagation()
              onUpdate(position, { broker: e.target.value })
            }}
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-0.5 rounded bg-[#1c2028] border border-[#3d494c]/30 text-[10px] text-[#bcc9cd] font-mono"
          >
            {withCurrent(brokers, selected).map((b) => (
              <option key={b} value={b} className="bg-[#181c24] text-[#dfe2ee]">
                {b}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (position) => {
        const quote = getQuote(position.ticker)
        const canSell = quote.status === 'ready' && quote.price
        const isSelling = sellingTicker === position.ticker
        return (
          <button
            type="button"
            disabled={!canSell || isSelling}
            onClick={() => {
              if (quote.price) {
                onSellAll(position, quote.price)
              }
            }}
            className="px-2 py-1 text-xs font-mono rounded bg-[#ff7f8b]/10 text-[#ff7f8b] border border-[#ff7f8b]/30 hover:bg-[#ff7f8b]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSelling ? 'Vendiendo...' : 'Vender'}
          </button>
        )
      },
    },
  ]
}

export interface HoldingsTableProps {
  positions: PortfolioPosition[]
  onPositionsChange?: () => void
}

/**
 * Holdings table for the portfolio workspace.
 */
export function HoldingsTable({ positions, onPositionsChange }: HoldingsTableProps) {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({})
  const [sellingTicker, setSellingTicker] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [drafts, setDrafts] = useState<Record<string, PositionPatch>>({})
  const [tickerFilter, setTickerFilter] = useState('')
  const [brokerFilter, setBrokerFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [aliases, setAliases] = useState<TickerAlias[]>([])

  const refreshMinutes = useSyncExternalStore(
    subscribeRefreshMinutes,
    readRefreshMinutes,
    () => DEFAULT_REFRESH_MINUTES,
  )
  const brokers = useSyncExternalStore(subscribeCatalog, readBrokers, readBrokers)
  const categories = useSyncExternalStore(subscribeCatalog, readCategories, readCategories)

  useEffect(() => {
    let active = true
    const tickers = Array.from(new Set(positions.map((p) => p.ticker)))

    for (const ticker of tickers) {
      marketApi
        .getAnalysis(ticker, '1mo')
        .then((data) => {
          if (!active) return
          setQuotes((prev) => ({
            ...prev,
            [ticker]: { price: data?.current_price ?? null, status: 'ready' },
          }))
          setUpdatedAt(new Date())
        })
        .catch(() => {
          if (!active) return
          setQuotes((prev) => ({
            ...prev,
            [ticker]: { price: null, status: 'error' },
          }))
        })
    }

    return () => {
      active = false
    }
  }, [positions, refreshKey])

  useEffect(() => {
    let active = true
    api
      .listTickerAliases()
      .then((aliasList) => {
        if (!active) return
        setAliases(aliasList)
      })
      .catch(() => {
        if (!active) return
        setAliases([])
      })
    return () => {
      active = false
    }
  }, [])

  /** Map from position ticker to its alias display name, if any. */
  const aliasByTicker = new Map(
    aliases.map((alias) => [alias.broker_ticker.toUpperCase(), alias.official_name]),
  )

  /** Display name for a position: alias official_name if found (by broker_ticker or official_name), else raw ticker. */
  function displayTicker(ticker: string): string {
    const byBroker = aliasByTicker.get(ticker.toUpperCase())
    if (byBroker) return byBroker
    // Search by official_name (for positions whose ticker is the alias short name)
    const matchByOfficial = aliases.find((a: TickerAlias) => a.official_name.toUpperCase() === ticker.toUpperCase())
    if (matchByOfficial) return matchByOfficial.official_name
    return ticker
  }

  const getQuote = (ticker: string) => quotes[ticker] ?? { price: null, status: 'loading' as const }

  const normalizedTickerFilter = tickerFilter.trim().toUpperCase()
  const visiblePositions = positions.filter((position) => {
    if (normalizedTickerFilter) {
      const d = displayTicker(position.ticker).toUpperCase()
      const t = position.ticker.toUpperCase()
      if (!d.includes(normalizedTickerFilter) && !t.includes(normalizedTickerFilter)) {
        return false
      }
    }
    if (brokerFilter && position.broker !== brokerFilter) return false
    if (categoryFilter && position.category !== categoryFilter) return false
    return true
  })
  const hasFilters = normalizedTickerFilter !== '' || brokerFilter !== '' || categoryFilter !== ''

  function clearFilters() {
    setTickerFilter('')
    setBrokerFilter('')
    setCategoryFilter('')
  }

  const handleSellAll = async (position: PortfolioPosition, price: string) => {
    try {
      setSellingTicker(position.ticker)
      await api.createTransaction({
        ticker: position.ticker,
        broker: position.broker,
        category: position.category,
        operation_type: 'SELL',
        quantity: position.quantity,
        unit_price: price,
        currency: position.currency,
        occurred_at: new Date().toISOString(),
      })
      onPositionsChange?.()
    } catch (error) {
      console.error('Failed to sell position', error)
    } finally {
      setSellingTicker(null)
    }
  }

  const handleUpdate = async (position: PortfolioPosition, payload: PositionPatch) => {
    // Show the choice immediately: the select is driven by server state, so
    // without this the control snaps back until the reload finishes.
    const key = positionKey(position)
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...payload } }))

    try {
      await api.updatePortfolioPosition(
        position.ticker,
        { broker: position.broker, category: position.category },
        payload,
      )
      onPositionsChange?.()
    } catch (error) {
      console.error('Failed to update position', error)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-[#869397] font-mono">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            schedule
          </span>
          Próxima actualización en
          <AutoRefreshTimer
            key={`${refreshMinutes}-${refreshKey}`}
            minutes={refreshMinutes}
            onElapsed={() => setRefreshKey((key) => key + 1)}
          />
          <span className="text-[#3d494c]">·</span>
          cada {refreshMinutes} {refreshMinutes === 1 ? 'minuto' : 'minutos'}
          {updatedAt ? (
            <>
              <span className="text-[#3d494c]">·</span>
              <span data-testid="quotes-updated-at">
                actualizado {updatedAt.toLocaleTimeString('es-AR')}
              </span>
            </>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="flex items-center gap-1 text-[11px] font-mono text-[#4cd7f6] hover:text-white transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
            refresh
          </span>
          Actualizar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="relative flex items-center">
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute left-2 text-[#869397] pointer-events-none text-[15px]"
          >
            search
          </span>
          <input
            type="search"
            value={tickerFilter}
            onChange={(event) => setTickerFilter(event.target.value)}
            placeholder="Filtrar ticker…"
            aria-label="Filtro de ticker"
            className="w-40 pl-7 pr-2 py-1 rounded-lg bg-[#1c2028] border border-[#3d494c]/40 text-[11px] font-mono text-white placeholder-[#869397] focus:outline-none focus:border-[#4cd7f6]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filtro de tipo"
          className="px-2 py-1 rounded-lg bg-[#1c2028] border border-[#3d494c]/40 text-[11px] font-mono text-white focus:outline-none focus:border-[#4cd7f6]"
        >
          <option value="" className="bg-[#181c24] text-white">
            Todos los activos
          </option>
          {categories.map((category) => (
            <option key={category} value={category} className="bg-[#181c24] text-white">
              {category}
            </option>
          ))}
        </select>
        <select
          value={brokerFilter}
          onChange={(event) => setBrokerFilter(event.target.value)}
          aria-label="Filtro de broker"
          className="px-2 py-1 rounded-lg bg-[#1c2028] border border-[#3d494c]/40 text-[11px] font-mono text-white focus:outline-none focus:border-[#4cd7f6]"
        >
          <option value="" className="bg-[#181c24] text-white">
            Todos los brokers
          </option>
          {brokers.map((broker) => (
            <option key={broker} value={broker} className="bg-[#181c24] text-white">
              {broker}
            </option>
          ))}
        </select>
        {hasFilters ? (
          <>
            <span className="text-[11px] font-mono text-[#869397]">
              {visiblePositions.length} de {positions.length}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] font-mono text-[#869397] hover:text-white transition-colors"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                filter_alt_off
              </span>
              Limpiar
            </button>
          </>
        ) : null}
      </div>
      <DataTable
        caption="Holdings"
        columns={makeColumns(
          getQuote,
          handleSellAll,
          sellingTicker,
          handleUpdate,
          brokers,
          categories,
          drafts,
          displayTicker,
        )}
        rows={visiblePositions}
        getRowKey={(position, index) =>
          `${position.ticker}-${position.broker}-${position.category}-${index}`
        }
        emptyMessage={hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No holdings yet.'}
      />
    </div>
  )
}
