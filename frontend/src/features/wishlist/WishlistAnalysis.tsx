/**
 * Wishlist analysis card: price history and variation for one wishlist ticker.
 *
 * Reuses the market chart and the shared async states. Percentages arrive as
 * canonical strings and are formatted for es-AR display only; they are never
 * shown with a currency symbol.
 */

import { useEffect, useState } from 'react'

import { describeApiError } from '../../api/errors'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates'
import { MarketChart } from '../market/MarketChart'
import { toChartSeries } from '../market/series'
import { wishlistApi } from './wishlistApi'
import type { WishlistHistory, WishlistHistoryPeriod } from './wishlistApi'

/** Selector options: UI label mapped to the provider period. */
const PERIODS: { label: string; value: WishlistHistoryPeriod }[] = [
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '12M', value: '1y' },
]

const PERCENT_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

interface HistoryState {
  /** Request this result belongs to, `ticker|period`. */
  key: string
  history: WishlistHistory | null
  error: unknown
}

/** Format a canonical percent string as `+12,50%`, or a dash when unknown. */
function formatPercent(value: string | null): string {
  if (value === null) return '—'
  const number = Number(value)
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toLocaleString('es-AR', PERCENT_FORMAT)}%`
}

/** Format a canonical close string as `$ 1.234,50`. */
function formatClose(value: string): string {
  return `$ ${Number(value).toLocaleString('es-AR', PERCENT_FORMAT)}`
}

/** Load the history for one ticker and period; stale results are ignored. */
function useWishlistHistory(ticker: string, period: WishlistHistoryPeriod) {
  const key = `${ticker}|${period}`
  const [state, setState] = useState<HistoryState | null>(null)

  useEffect(() => {
    let active = true
    wishlistApi
      .history(ticker, period)
      .then((history) => {
        if (active) setState({ key, history, error: null })
      })
      .catch((error: unknown) => {
        if (active) setState({ key, history: null, error })
      })
    return () => {
      active = false
    }
  }, [ticker, period, key])

  return state !== null && state.key === key ? state : null
}

interface VariationProps {
  label: string
  value: string | null
}

/** One labelled variation figure. */
function Variation({ label, value }: VariationProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-mono text-[#869397] uppercase">{label}</span>
      <span className="text-base font-bold font-mono text-white">{formatPercent(value)}</span>
    </div>
  )
}

interface PeriodSelectorProps {
  period: WishlistHistoryPeriod
  onChange: (period: WishlistHistoryPeriod) => void
}

/** Segmented 3M / 6M / 12M control. */
function PeriodSelector({ period, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-[#1c2028] p-1 rounded-lg">
      {PERIODS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === period}
          onClick={() => onChange(option.value)}
          className={`flex-1 py-1 px-3 text-xs font-mono uppercase rounded font-bold ${
            option.value === period ? 'bg-[#06b6d4] text-[#003640]' : 'text-[#869397]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface WishlistAnalysisProps {
  ticker: string
  onClose: () => void
}

/** Show the price history, chart and variations for the analyzed ticker. */
export function WishlistAnalysis({ ticker, onClose }: WishlistAnalysisProps) {
  const [period, setPeriod] = useState<WishlistHistoryPeriod>('3mo')
  const result = useWishlistHistory(ticker, period)
  const history = result?.history ?? null
  const hasPoints = history !== null && history.points.length > 0
  const lastClose = hasPoints ? history.points[history.points.length - 1].close : null

  return (
    <div
      data-testid="wishlist-analysis"
      className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold font-headline flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">monitoring</span>
          {`Analysis: ${ticker}`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-mono uppercase text-[#869397] hover:text-[#4cd7f6]"
        >
          Close
        </button>
      </div>

      <PeriodSelector period={period} onChange={setPeriod} />

      {result === null ? <LoadingState label="Loading history…" /> : null}
      {result?.error ? <ErrorState message={describeApiError(result.error)} /> : null}
      {history !== null && !hasPoints ? <EmptyState message="No price history available." /> : null}
      {hasPoints ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Variation label="Monthly variation" value={history.monthly_variation_percent} />
            <Variation label="Period variation" value={history.period_variation_percent} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-[#869397] uppercase">Last close</span>
              <span className="text-base font-bold font-mono text-white">
                {lastClose === null ? '—' : formatClose(lastClose)}
              </span>
            </div>
          </div>
          <MarketChart series={toChartSeries(history.points)} mode="line" />
        </>
      ) : null}
    </div>
  )
}
