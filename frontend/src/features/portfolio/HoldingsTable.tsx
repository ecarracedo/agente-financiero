/**
 * Holdings table for the portfolio workspace.
 */

import { useEffect, useState } from 'react'

import type { PortfolioPosition } from '../../api/client'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import { marketApi } from '../market/marketApi'

type QuoteState = {
  price: string | null
  status: 'loading' | 'ready' | 'error'
}

function VariationCell({ position, currentPrice }: { position: PortfolioPosition; currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-[#869397]">—</span>
  const avg = Number(position.average_price)
  const cur = Number(currentPrice)
  if (!Number.isFinite(avg) || avg === 0 || !Number.isFinite(cur)) {
    return <span className="font-mono text-[#869397]">—</span>
  }
  const pct = ((cur - avg) / avg) * 100
  const isPositive = pct >= 0
  return (
    <span className={`font-mono ${isPositive ? 'text-[#46fa9c]' : 'text-[#ff7f8b]'}`}>
      {isPositive ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  )
}

function TotalCell({ position, currentPrice }: { position: PortfolioPosition; currentPrice: string | null }) {
  if (!currentPrice) return <span className="font-mono text-[#869397]">—</span>
  const qty = Number(position.quantity)
  const cur = Number(currentPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(cur)) return <span className="font-mono text-[#869397]">—</span>
  const total = qty * cur
  const formatted = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <span className="font-mono text-white">${formatted}</span>
}

function makeColumns(getQuote: (ticker: string) => QuoteState): Column<PortfolioPosition>[] {
  return [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (position) => (
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="w-7 h-7 rounded-md bg-[#262a33] border border-[#3d494c]/50 flex items-center justify-center font-bold text-xs text-[#4cd7f6] font-mono shrink-0"
          >
            {position.ticker.slice(0, 2)}
          </div>
          <span className="font-bold text-white font-mono">{position.ticker}</span>
        </div>
      ),
    },
    {
      key: 'broker',
      header: 'Broker',
      render: (position) => (
        <span className="px-2 py-0.5 rounded bg-[#1c2028] border border-[#3d494c]/30 text-xs text-[#bcc9cd] font-mono">
          {position.broker}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (position) => (
        <span className="px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-xs font-medium text-[#4cd7f6]">
          {position.category}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      align: 'right',
      render: (position) => (
        <span className="font-mono text-white">{position.quantity}</span>
      ),
    },
    {
      key: 'average_price',
      header: 'Precio Promedio',
      align: 'right',
      render: (position) => (
        <CurrencyAmount amount={position.average_price} currency={position.currency} />
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (position) => <TotalCell position={position} currentPrice={getQuote(position.ticker).price} />,
    },
    {
      key: 'variation',
      header: 'Variación',
      align: 'right',
      render: (position) => <VariationCell position={position} currentPrice={getQuote(position.ticker).price} />,
    },
  ]
}

export interface HoldingsTableProps {
  positions: PortfolioPosition[]
}

/**
 * Holdings table for the portfolio workspace.
 */
export function HoldingsTable({ positions }: HoldingsTableProps) {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({})

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

  return (
    <DataTable
      caption="Holdings"
      columns={makeColumns(getQuote)}
      rows={positions}
      getRowKey={(position, index) =>
        `${position.ticker}-${position.broker}-${position.category}-${index}`
      }
      emptyMessage="No holdings yet."
    />
  )
}
