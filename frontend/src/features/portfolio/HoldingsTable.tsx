/**
 * Holdings table for the portfolio workspace.
 */

import { useEffect, useState } from 'react'

import type { PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import { marketApi } from '../market/marketApi'

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
      header: 'Category',
      render: (position) => (
        <span className="px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-[10px] font-medium text-[#4cd7f6]">
          {position.category}
        </span>
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
      header: 'Precio Promedio',
      align: 'center',
      render: (position) => <PriceCell amount={position.average_price} />,
    },
    {
      key: 'current_price',
      header: 'Precio Actual',
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
      render: () => (
        <span className="px-2 py-0.5 rounded bg-[#1c2028] border border-[#3d494c]/30 text-[10px] text-[#bcc9cd] font-mono">
          ECO
        </span>
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

  useEffect(() => {
    let active = true
    const tickers = Array.from(new Set(positions.map((p) => p.ticker)))

    for (const ticker of tickers) {
      if (quotes[ticker]?.status === 'ready') continue
      setQuotes((prev) => ({ ...prev, [ticker]: { price: null, status: 'loading' } }))
      marketApi
        .getAnalysis(ticker, '1mo')
        .then((data) => {
          if (!active) return
          setQuotes((prev) => ({
            ...prev,
            [ticker]: { price: data?.current_price ?? null, status: 'ready' },
          }))
        })
        .catch(() => {
          if (!active) return
          setQuotes((prev) => ({ ...prev, [ticker]: { price: null, status: 'error' } }))
        })
    }

    return () => {
      active = false
    }
  }, [positions])

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
      } as any)
      onPositionsChange?.()
    } catch (error) {
      console.error('Failed to sell position', error)
    } finally {
      setSellingTicker(null)
    }
  }

  return (
    <DataTable
      caption="Holdings"
      columns={makeColumns(getQuote, handleSellAll, sellingTicker)}
      rows={positions}
      getRowKey={(position, index) =>
        `${position.ticker}-${position.broker}-${position.category}-${index}`
      }
      emptyMessage="No holdings yet."
    />
  )
}
