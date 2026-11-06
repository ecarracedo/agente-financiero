/**
 * Asset Distribution / allocation card computed from real portfolio data.
 *
 * Positions come from `GET /api/v1/portfolio` (already loaded by the
 * workspace). Each position is valued at its current market price
 * (`quantity` x `current_price` from `GET /api/v1/analysis/{ticker}`, the
 * same quote source HoldingsTable uses) and grouped by its real `category`
 * inside its own currency. Currencies are never summed together: there is
 * no FX endpoint, so every total, donut and bar is per currency.
 *
 * Positions without a current price are excluded from every total and
 * percentage and are declared separately; they are never counted as zero.
 */

import { useEffect, useState } from 'react'

import type { CurrencyValuation, PortfolioPosition } from '../../api/client'
import { marketApi } from '../market/marketApi'

export interface AssetDistributionCardProps {
  /** Portfolio positions loaded by the workspace. */
  positions: PortfolioPosition[]
  /** Currency-grouped valuations loaded by the workspace. */
  valuations: CurrencyValuation[]
  /** Bump to refetch quotes, e.g. after a transaction or manual refresh. */
  refreshToken?: number
}

/** Palette cycled across the categories of one currency section. */
const PALETTE = ['#4cd7f6', '#46fa9c', '#acedff', '#869397', '#ffb4ab', '#f9e79f']

/** One category inside one currency: valued total and its tickers. */
interface CategorySlice {
  name: string
  value: number
  tickers: string[]
  percentage: number
  color: string
}

/** All slices of one currency plus its valued total. */
interface CurrencySection {
  currency: string
  total: number
  slices: CategorySlice[]
}

/** Format a number as "$ 1.000,00" (global currency format). */
function formatMoney(value: number): string {
  return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Group priced positions by currency and category, with per-currency totals. */
function buildSections(
  positions: PortfolioPosition[],
  prices: Record<string, string | null>,
): { sections: CurrencySection[]; unpriced: string[] } {
  const unpriced = new Set<string>()
  const byCurrency = new Map<string, Map<string, { value: number; tickers: Set<string> }>>()

  for (const position of positions) {
    const price = prices[position.ticker]
    const qty = Number(position.quantity)
    const current = price !== null && price !== undefined ? Number(price) : Number.NaN
    if (!Number.isFinite(qty) || !Number.isFinite(current)) {
      unpriced.add(position.ticker)
      continue
    }
    let categories = byCurrency.get(position.currency)
    if (!categories) {
      categories = new Map()
      byCurrency.set(position.currency, categories)
    }
    let slice = categories.get(position.category)
    if (!slice) {
      slice = { value: 0, tickers: new Set() }
      categories.set(position.category, slice)
    }
    slice.value += qty * current
    slice.tickers.add(position.ticker)
  }

  const sections: CurrencySection[] = []
  for (const [currency, categories] of byCurrency) {
    const total = Array.from(categories.values()).reduce((sum, s) => sum + s.value, 0)
    if (total <= 0) continue
    const slices: CategorySlice[] = Array.from(categories.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, s], index) => ({
        name,
        value: s.value,
        tickers: Array.from(s.tickers).sort(),
        percentage: (s.value / total) * 100,
        color: PALETTE[index % PALETTE.length],
      }))
    sections.push({ currency, total, slices })
  }
  sections.sort((a, b) => a.currency.localeCompare(b.currency))
  return { sections, unpriced: Array.from(unpriced).sort() }
}

/** Donut segments for one currency section. */
function Donut({ slices }: { slices: CategorySlice[] }) {
  const built = slices.reduce(
    (acc, slice) => {
      acc.segments.push({ slice, dashoffset: -acc.running })
      acc.running += slice.percentage
      return acc
    },
    { running: 0, segments: [] as { slice: CategorySlice; dashoffset: number }[] },
  ).segments
  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" fill="none" r="15.915" stroke="#1c2028" strokeWidth="3.8" />
      {built.map(({ slice, dashoffset }) => (
        <circle
          key={slice.name}
          cx="18"
          cy="18"
          fill="none"
          r="15.915"
          stroke={slice.color}
          strokeDasharray={`${slice.percentage} ${100 - slice.percentage}`}
          strokeDashoffset={dashoffset}
          strokeWidth="3.8"
        />
      ))}
    </svg>
  )
}

/** One currency section: donut, stacked bar and category cards. */
function CurrencySectionView({ section, loading }: { section: CurrencySection; loading: boolean }) {
  const { currency, total, slices } = section
  return (
    <div className="flex flex-col gap-3 border-t border-[#3d494c]/20 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#bcc9cd]">
          {currency}
        </span>
        <span className="text-xs font-mono font-semibold text-white">
          {formatMoney(total)} {currency}
          {loading ? <span className="ml-2 text-[#869397]">actualizando…</span> : null}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-1">
        <div className="lg:col-span-3 flex items-center justify-center gap-4 bg-[#0a0e16]/40 p-4 rounded-xl border border-[#3d494c]/20">
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <Donut slices={slices} />
            <div className="absolute flex flex-col items-center">
              <span className="text-[9px] font-mono text-[#869397]">TOTAL</span>
              <span className="text-sm font-bold font-mono text-white">{currency}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-[#869397] uppercase">Categorías</span>
            <span className="text-xs font-mono text-white font-semibold">{slices.length}</span>
            <span className="text-[10px] text-[#869397]">
              {slices.reduce((n, s) => n + s.tickers.length, 0)} activos valuados
            </span>
          </div>
        </div>

        <div className="lg:col-span-9 flex flex-col gap-3">
          <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#0a0e16]">
            {slices.map((slice) => (
              <div
                key={slice.name}
                className="h-full"
                style={{ width: `${slice.percentage}%`, backgroundColor: slice.color }}
                title={`${slice.name}: ${slice.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {slices.map((slice) => (
              <div
                key={slice.name}
                className="bg-[#1c2028]/60 p-3 rounded-lg flex flex-col gap-1 border border-[#3d494c]/15"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase text-[#dfe2ee]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    {slice.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: slice.color }}>
                    {slice.percentage.toLocaleString('es-AR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xs font-bold font-mono text-white">{formatMoney(slice.value)}</span>
                </div>
                <span className="text-[9px] text-[#869397]">
                  {slice.tickers.length} {slice.tickers.length === 1 ? 'Activo' : 'Activos'} (
                  {slice.tickers.join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Show the real allocation of the portfolio by asset class (category),
 * one section per currency, valued at current market prices.
 */
export function AssetDistributionCard({
  positions,
  valuations,
  refreshToken = 0,
}: AssetDistributionCardProps) {
  const [prices, setPrices] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(positions.length > 0)

  useEffect(() => {
    let active = true
    const tickers = Array.from(new Set(positions.map((p) => p.ticker)))
    if (tickers.length === 0) return () => {}

    Promise.all(
      tickers.map((ticker) =>
        marketApi
          .getAnalysis(ticker, '1mo')
          .then((data) => ({ ticker, price: data?.current_price ?? null }))
          .catch(() => ({ ticker, price: null as string | null })),
      ),
    ).then((results) => {
      if (!active) return
      setPrices(Object.fromEntries(results.map((r) => [r.ticker, r.price])))
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [positions, refreshToken])

  const { sections, unpriced } = buildSections(positions, prices)

  // Keep the currency order coming from the backend valuations when possible.
  const orderedSections =
    valuations.length > 0
      ? [...sections].sort(
          (a, b) =>
            valuations.findIndex((v) => v.currency === a.currency) -
            valuations.findIndex((v) => v.currency === b.currency),
        )
      : sections

  return (
    <div
      role="region"
      aria-label="Distribución de Activos"
      className="w-full bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20 relative overflow-hidden"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#3d494c]/20 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[#06b6d4]/10 text-[#4cd7f6] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">donut_large</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white font-headline">
              Distribución de Activos
            </h3>
            <p className="text-xs text-[#869397]">
              Desglose panorámico de asignación de capital institucional por clase de activo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#869397]">
            <span className="w-2 h-2 rounded-full bg-[#46fa9c]" />
            <span>PRECIOS DE MERCADO</span>
          </div>
          <span className="text-xs font-mono font-semibold text-white">
            {orderedSections.length} {orderedSections.length === 1 ? 'MONEDA' : 'MONEDAS'}
          </span>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="text-sm text-[#869397] py-6 text-center">
          Sin posiciones para distribuir: todavía no hay activos en cartera.
        </p>
      ) : loading && orderedSections.length === 0 ? (
        <p className="text-sm text-[#869397] py-6 text-center">Valuando posiciones…</p>
      ) : (
        <>
          {orderedSections.map((section) => (
            <CurrencySectionView key={section.currency} section={section} loading={loading} />
          ))}
          {orderedSections.length === 0 && !loading ? (
            <p className="text-sm text-[#869397] py-6 text-center">
              Sin posiciones valuadas: los precios de mercado no están disponibles todavía.
            </p>
          ) : null}
        </>
      )}

      {unpriced.length > 0 && positions.length > 0 ? (
        <p className="text-[11px] font-mono text-[#869397]">
          {unpriced.length} {unpriced.length === 1 ? 'activo sin valuar' : 'activos sin valuar'}:
          {unpriced.join(', ')}
        </p>
      ) : null}
    </div>
  )
}
