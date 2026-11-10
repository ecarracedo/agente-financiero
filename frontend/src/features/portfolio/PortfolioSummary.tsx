/**
 * Compact portfolio summary with ARS total (USD at CCL) and real gain logic.
 */

import { useEffect, useState } from 'react'

import type { CurrencyValuation, DollarRates, PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'
import { marketApi } from '../market/marketApi'
import { Card } from '../../components/tremor/Card'

export interface PortfolioSummaryProps {
  positions: PortfolioPosition[]
  valuations: CurrencyValuation[]
}

interface DailyChange {
  value: number
  previous: number
}

/** Format a percent with sign and comma decimal (es-AR), e.g. +17,14%. */
function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

/** Format a money amount with the global format, e.g. $ 1.000,00. */
function formatMoney(value: number): string {
  return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Show institutional portfolio totals and summary metrics. */
export function PortfolioSummary({ positions, valuations }: PortfolioSummaryProps) {
  const primaryValuation = valuations.find((v) => v.currency === 'USD') ?? valuations[0]
  const totalUsd = primaryValuation?.market_value ?? primaryValuation?.invested_value ?? null
  const gainPercent = primaryValuation?.gain_loss_percent ?? null
  const [rates, setRates] = useState<DollarRates | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [ratesFailed, setRatesFailed] = useState(false)
  const [dailyChange, setDailyChange] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setRatesLoading(true)
    setRatesFailed(false)
    const timeout = setTimeout(() => {
      if (active && rates === null && !ratesFailed) {
        setRatesFailed(true)
        setRatesLoading(false)
      }
    }, 8000)
    api
      .getDollarRates()
      .then((r) => {
        if (active) {
          setRates(r)
          setRatesLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setRatesFailed(true)
          setRatesLoading(false)
        }
      })
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [])

  // 24H change: value-weighted daily move across holdings, from each
  // position's own series (last two closes). No hardcoded percentage.
  useEffect(() => {
    let active = true
    const tickers = [...new Set(positions.map((p) => p.ticker))]
    if (!tickers.length) return
    Promise.all(
      tickers.map(async (ticker) => {
        try {
          const analysis = await marketApi.getAnalysis(ticker, '1mo')
          const series = analysis.series ?? []
          if (series.length < 2) return null
          const last = Number(series[series.length - 1].close)
          const prev = Number(series[series.length - 2].close)
          if (!Number.isFinite(last) || !Number.isFinite(prev) || prev <= 0) return null
          const qty = positions
            .filter((p) => p.ticker === ticker)
            .reduce((sum, p) => sum + Number(p.quantity), 0)
          return { value: qty * last, previous: qty * prev } satisfies DailyChange
        } catch {
          return null
        }
      }),
    ).then((changes) => {
      if (!active) return
      const valid = changes.filter((c): c is DailyChange => c !== null)
      if (!valid.length) return
      const value = valid.reduce((s, c) => s + c.value, 0)
      const previous = valid.reduce((s, c) => s + c.previous, 0)
      if (previous > 0) setDailyChange(((value - previous) / previous) * 100)
    })
    return () => {
      active = false
    }
  }, [positions])

  const ccl = rates?.ccl ? Number(rates.ccl) : null
  const arsValuation = valuations.find((v) => v.currency === 'ARS')
  const arsMarket = arsValuation?.market_value ?? arsValuation?.invested_value ?? null
  // Total ARS = ARS holdings + USD holdings converted at CCL.
  const totalArs =
    ccl && (arsMarket || totalUsd) ? Number(arsMarket ?? 0) + Number(totalUsd ?? 0) * ccl : null
  // Fallback: if CCL never arrives, show the USD amount so the total is never blank.
  const showUsdFallback = ratesFailed && totalUsd !== null && !ccl
  // Combined gain: USD gain at CCL plus ARS gain, over combined invested.
  const usdInvested = primaryValuation?.currency === 'USD' ? primaryValuation.invested_value : null
  const combinedGain =
    ccl && arsValuation && usdInvested && primaryValuation?.gain_loss
      ? ((Number(primaryValuation.gain_loss) * ccl + Number(arsValuation.gain_loss ?? 0)) /
          (Number(usdInvested) * ccl + Number(arsValuation.invested_value))) * 100
      : gainPercent !== null
        ? Number(gainPercent)
        : null
  const gainValue = combinedGain
  const totalLabel = showUsdFallback ? 'USD' : 'ARS'
  const totalValue =
    ratesLoading
      ? null
      : showUsdFallback
        ? Number(totalUsd)
        : totalArs

  return (
    <Card className="relative overflow-hidden border border-[#3d494c]/30 p-6 lg:p-8">
      {/* Background radial glows from Stitch */}
      <div className="absolute -right-20 -top-24 w-96 h-96 bg-[#4cd7f6]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-24 w-96 h-96 bg-[#46fa9c]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Main Portfolio Total */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono">
              PORTAFOLIO INSTITUCIONAL
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl lg:text-4xl font-bold font-mono text-white tracking-tight">
              {ratesLoading ? (
                <span className="animate-pulse text-[#869397]">—</span>
              ) : totalValue !== null
                ? `${formatMoney(totalValue)}`
                : '—'}
              <span className="text-sm font-normal text-[#869397] ml-2">{totalLabel}</span>
            </h1>
            {gainValue !== null ? (
              <div className="flex items-center gap-1.5 bg-[#46fa9c]/10 border border-[#46fa9c]/20 px-2.5 py-1 rounded-lg">
                <span className="material-symbols-outlined text-[#46fa9c] text-[16px]">trending_up</span>
                <span className="text-xs font-mono font-semibold text-[#46fa9c]">{formatPercent(gainValue)}</span>
                <span className="text-[10px] font-mono text-[#869397] ml-1">TOTAL</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 bg-[#262a33] px-2.5 py-1 rounded-lg">
              <span className="text-[10px] font-mono text-[#bcc9cd]">24H:</span>
              <span className="text-xs font-mono font-medium text-[#46fa9c]">
                {dailyChange !== null ? formatPercent(dailyChange) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Cluster in DL for semantic compliance */}
        <dl className="grid grid-cols-2 gap-3">
          <div className="bg-[#1c2028]/70 p-3.5 rounded-lg flex flex-col justify-center border border-[#3d494c]/20">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono mb-1">
              Posiciones
            </dt>
            <dd className="text-xl font-bold font-mono text-white">{positions.length}</dd>
            <span className="text-[10px] font-mono text-[#869397] mt-0.5">ACTIVAS EN CARTERA</span>
          </div>

          <div className="bg-[#1c2028]/70 p-3.5 rounded-lg flex flex-col justify-center border border-[#3d494c]/20">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono mb-1">
              Moneda
            </dt>
            <dd className="text-xl font-bold font-mono text-[#4cd7f6]">{valuations.length}</dd>
            <span className="text-[10px] font-mono text-[#869397] mt-0.5">GRUPOS DE VALOR</span>
          </div>
        </dl>
      </div>
    </Card>
  )
}
