/**
 * Holdings table for the portfolio workspace.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'

import type { PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import { marketApi } from '../market/marketApi'
import {
  DEFAULT_REFRESH_MINUTES,
  readRefreshMinutes,
  subscribeRefreshMinutes,
} from '../settings/refreshInterval'
import { AutoRefreshTimer } from './AutoRefreshTimer'

const BROKERS = ['ECO', 'PPI', 'BINANCE']
const CATEGORIES = ['Acciones', 'Cedear', 'ETF', 'Bono', 'FCI', 'Cripto']

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
  const formatted = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className={`font-mono text-xs ${isPositive ? 'text-[#46fa9c]' : 'text-[#ff7f8b]'}`}>
      {isPositive ? '+' : '-'}${formatted}
    </span>
  )
}



function TotalCell({ position, currentPrice }: { position: PortfolioPosition; currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-xs text-[#869397]">—</span>
  const qty = Number(position.quantity)
  const cur = Number(currentPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(cur)) return <span className="font-mono text-xs text-[#869397]">—</span>
  const total = qty * cur
  const formatted = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className="font-mono text-xs text-white">
      ${formatted} <span className="text-[#869397]">{position.currency}</span>
    </span>
  )
}

function PriceCell({ amount }: { amount: string }) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return <span className="font-mono text-xs text-[#869397]">—</span>
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span className="font-mono text-xs text-white">${formatted}</span>
}

function CurrentPriceCell({ currentPrice }: { currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-xs text-[#869397]">—</span>
  const num = Number(currentPrice)
  if (!Number.isFinite(num)) return <span className="font-mono text-xs text-[#869397]">—</span>
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span className="font-mono text-xs text-white">${formatted}</span>
}

function makeColumns(
  getQuote: (ticker: string) => QuoteState,
  onSellAll: (position: PortfolioPosition, price: string) => void,
  sellingTicker: string | null,
  onUpdate: (position: PortfolioPosition, payload: { broker?: string; category?: string }) => void,
): Column<PortfolioPosition>[] {
  return [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (position) => (
        <span className="font-bold text-xs text-white font-mono">{position.ticker}</span>
      ),
    },
    {
      key: 'category',
      header: 'Activo',
      render: (position) => (
        <select
          value={position.category}
          onChange={(e) => {
            e.stopPropagation()
            onUpdate(position, { category: e.target.value })
          }}
          onClick={(e) => e.stopPropagation()}
          className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/10 text-[10px] font-medium text-[#4cd7f6] border border-[#4cd7f6]/30"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-[#181c24] text-[#dfe2ee]">
              {c}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'center',
      render: (position) => (
        <span className="font-mono text-xs text-white">{position.quantity}</span>
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
      render: (position) => (
        <select
          value={position.broker}
          onChange={(e) => {
            e.stopPropagation()
            onUpdate(position, { broker: e.target.value })
          }}
          onClick={(e) => e.stopPropagation()}
          className="px-1.5 py-0.5 rounded bg-[#1c2028] border border-[#3d494c]/30 text-[10px] text-[#bcc9cd] font-mono"
        >
          {BROKERS.map((b) => (
            <option key={b} value={b} className="bg-[#181c24] text-[#dfe2ee]">
              {b}
            </option>
          ))}
        </select>
      ),
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

  const refreshMinutes = useSyncExternalStore(
    subscribeRefreshMinutes,
    readRefreshMinutes,
    () => DEFAULT_REFRESH_MINUTES,
  )

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

  const getQuote = (ticker: string) => quotes[ticker] ?? { price: null, status: 'loading' as const }

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

  const handleUpdate = async (position: PortfolioPosition, payload: { broker?: string; category?: string }) => {
    try {
      await api.updatePortfolioPosition(
        position.ticker,
        { broker: position.broker, category: position.category },
        payload,
      )
      onPositionsChange?.()
    } catch (error) {
      console.error('Failed to update position', error)
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
      <DataTable
        caption="Holdings"
        columns={makeColumns(getQuote, handleSellAll, sellingTicker, handleUpdate)}
        rows={positions}
        getRowKey={(position, index) =>
          `${position.ticker}-${position.broker}-${position.category}-${index}`
        }
        emptyMessage="No holdings yet."
      />
    </div>
  )
}
