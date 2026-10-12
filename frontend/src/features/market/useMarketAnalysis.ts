/**
 * Data-fetching hook for the market analysis of a ticker/period pair.
 */

import { useEffect, useState } from 'react'

import type { MarketAnalysis, MarketPeriod } from './marketApi'
import { marketApi } from './marketApi'

export type MarketAnalysisStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface MarketAnalysisResult {
  status: MarketAnalysisStatus
  analysis: MarketAnalysis | null
  error: unknown
}

interface ResolvedAnalysis {
  ticker: string
  period: MarketPeriod
  analysis: MarketAnalysis
}

interface FailedAnalysis {
  ticker: string
  period: MarketPeriod
  error: unknown
}

/**
 * Load the market analysis for a ticker and period.
 *
 * Status is derived from the resolved/failed request identity so a newly
 * selected ticker or period reports `loading` until its request settles,
 * without synchronously writing state from the effect body.
 *
 * @param ticker Ticker to analyze; an empty value performs no request.
 * @param period Analysis period; a change triggers a refetch.
 */
export function useMarketAnalysis(
  ticker: string,
  period: MarketPeriod,
): MarketAnalysisResult {
  const [resolved, setResolved] = useState<ResolvedAnalysis | null>(null)
  const [failure, setFailure] = useState<FailedAnalysis | null>(null)

  const normalizedTicker = ticker.trim().toUpperCase()
  const idle = normalizedTicker === ''

  useEffect(() => {
    if (idle) return

    let active = true

    marketApi
      .getAnalysis(normalizedTicker, period)
      .then((analysis) => {
        if (!active) return
        setResolved({ ticker: normalizedTicker, period, analysis })
        setFailure(null)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setFailure({ ticker: normalizedTicker, period, error: caught })
      })

    return () => {
      active = false
    }
  }, [idle, normalizedTicker, period])

  if (idle) {
    return { status: 'idle', analysis: null, error: null }
  }
  if (failure !== null && failure.ticker === normalizedTicker && failure.period === period) {
    return { status: 'error', analysis: null, error: failure.error }
  }
  if (resolved !== null && resolved.ticker === normalizedTicker && resolved.period === period) {
    return { status: 'ready', analysis: resolved.analysis, error: null }
  }
  return { status: 'loading', analysis: null, error: null }
}
