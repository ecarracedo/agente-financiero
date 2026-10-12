/**
 * Pure helpers that turn canonical market strings into chart-ready geometry.
 *
 * Monetary values arrive as canonical strings and are parsed to numbers ONLY to
 * position chart geometry. The canonical strings are preserved for display so
 * the UI never shows a parsed (possibly rounded) number.
 */

import type { TransactionSummary } from '../../api/client'
import type { components } from '../../api/types'

/** One dated close as serialized by `GET /api/v1/analysis/{ticker}`. */
export type PricePoint = components['schemas']['PricePointResponse']

/** A single plottable close point with both geometry and display values. */
export interface ChartPoint {
  /** ISO date exactly as sent by the backend. */
  date: string
  /** Unix milliseconds used as the numeric x-axis position. */
  timestamp: number
  /** Numeric close used only for chart geometry. */
  close: number
  /** Canonical close string kept for display. */
  closeLabel: string
}

/** A transaction marker placed on the price chart for the selected position. */
export interface TransactionMarker {
  id: number
  date: string
  timestamp: number
  price: number
  priceLabel: string
  operationType: string
  currency: string
}

/** Map chronological price points to chart geometry. */
export function toChartSeries(points: PricePoint[]): ChartPoint[] {
  return points.map((point) => ({
    date: point.date,
    timestamp: Date.parse(point.date),
    close: Number(point.close),
    closeLabel: point.close,
  }))
}

/** Parse a canonical target string for the overlay, or `null` when unset. */
export function toTargetValue(targetPrice: string | null | undefined): number | null {
  if (targetPrice === null || targetPrice === undefined || targetPrice.trim() === '') {
    return null
  }
  const parsed = Number(targetPrice)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Build a padded numeric value domain that always includes the target.
 *
 * The target line must stay visible even when it sits outside the observed
 * price range, so it is folded into the domain instead of relying on the
 * chart's auto domain.
 */
export function toValueDomain(closes: number[], target: number | null): [number, number] {
  const values = target !== null ? [...closes, target] : closes
  if (values.length === 0) {
    return [0, 1]
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = max === min ? Math.abs(max) * 0.05 || 1 : (max - min) * 0.05
  return [min - pad, max + pad]
}

/** Map transactions to marker geometry while keeping canonical display strings. */
export function toTransactionMarkers(
  transactions: TransactionSummary[],
): TransactionMarker[] {
  return transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.occurred_at.slice(0, 10),
    timestamp: Date.parse(transaction.occurred_at),
    price: Number(transaction.unit_price),
    priceLabel: transaction.unit_price,
    operationType: transaction.operation_type,
    currency: transaction.currency,
  }))
}
