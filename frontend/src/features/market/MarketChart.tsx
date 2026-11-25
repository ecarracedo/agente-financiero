/**
 * Historical price chart with target-line and transaction-marker overlays.
 *
 * Uses recharts with an explicit width/height (no ResponsiveContainer) so the
 * SVG renders deterministically under jsdom and in the browser alike.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  XAxis,
  YAxis,
} from 'recharts'

import type { ChartPoint, TransactionMarker } from './series'
import { toValueDomain } from './series'

/** Default chart geometry keeps rendering deterministic and test-friendly. */
const CHART_WIDTH = 640
const CHART_HEIGHT = 320

/** Axis labels reuse the same mono token as the card's small labels. */
const AXIS_TICK_STYLE = {
  fill: '#869397',
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
} as const

export type ChartMode = 'line' | 'area'

export interface MarketChartProps {
  /** Chronological price series geometry. */
  series: ChartPoint[]
  /** Histogram style: a line or a filled area. */
  mode: ChartMode
  /** SVG width in pixels; callers with a wider container can override 640. */
  width?: number
  /** Target line value for the selected item, or `null` when unset. */
  targetPrice?: number | null
  /** Canonical target label rendered beside the target line. */
  targetLabel?: string | null
  /** Last observed close to mark with a horizontal reference line. */
  lastClosePrice?: number | null
  /** Canonical last-close label rendered beside that line. */
  lastCloseLabel?: string | null
  /** Transaction markers for the selected position. */
  markers?: TransactionMarker[]
}

/** Format a timestamp tick as an ISO date without a time component. */
function formatTick(value: number): string {
  return new Date(value).toISOString().slice(0, 10)
}

/**
 * Render the price series, optional target and last-close lines, and markers.
 *
 * Monetary values are shown through canonical strings in the marker list and
 * reference-line labels; the SVG itself only uses numeric geometry.
 */
export function MarketChart({
  series,
  mode,
  width = CHART_WIDTH,
  targetPrice = null,
  targetLabel = null,
  lastClosePrice = null,
  lastCloseLabel = null,
  markers = [],
}: MarketChartProps) {
  const ranges = series.flatMap((point) =>
    point.range ? [point.range] : [],
  )
  const yDomain = toValueDomain(
    series.map((point) => point.close),
    targetPrice,
    ranges,
  )
  const hasOutsideLastCloseLabel =
    lastClosePrice !== null && lastCloseLabel !== null && lastCloseLabel.trim() !== ''
  /** Reserve room so the last-close label can sit outside the plotting area. */
  const chartMargin = {
    top: 5,
    right: hasOutsideLastCloseLabel ? 88 : 5,
    bottom: 5,
    left: 5,
  }

  return (
    <div data-testid="market-chart">
      <ComposedChart width={width} height={CHART_HEIGHT} data={series} margin={chartMargin}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatTick}
          tick={AXIS_TICK_STYLE}
        />
        <YAxis domain={yDomain} tick={AXIS_TICK_STYLE} />
        {ranges.length > 0 ? (
          <Area
            data-testid="price-range-band"
            type="monotone"
            dataKey="range"
            stroke="#4cd7f6"
            fill="#06b6d4"
            fillOpacity={0.18}
            isAnimationActive={false}
          />
        ) : null}
        {mode === 'area' ? (
          <Area
            type="monotone"
            dataKey="close"
            stroke="#2563eb"
            fill="#93c5fd"
            isAnimationActive={false}
          />
        ) : (
          <Line
            type="monotone"
            dataKey="close"
            stroke="#2563eb"
            dot={false}
            isAnimationActive={false}
          />
        )}
        {targetPrice !== null ? (
          <ReferenceLine
            y={targetPrice}
            stroke="#d97706"
            strokeDasharray="4 4"
            label={targetLabel ?? undefined}
          />
        ) : null}
        {lastClosePrice !== null ? (
          <ReferenceLine
            data-testid="last-close-line"
            y={lastClosePrice}
            stroke="#4cd7f6"
            label={
              hasOutsideLastCloseLabel
                ? {
                    value: lastCloseLabel,
                    position: 'right',
                    offset: 6,
                    fill: '#4cd7f6',
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                  }
                : undefined
            }
          />
        ) : null}
        {markers.length > 0 ? (
          <Scatter
            data={markers}
            dataKey="price"
            fill="#dc2626"
            shape="circle"
            isAnimationActive={false}
          />
        ) : null}
      </ComposedChart>

      {markers.length > 0 ? (
        <ul aria-label="Transaction markers">
          {markers.map((marker) => (
            <li key={marker.id}>
              {marker.date} · {marker.operationType} · {marker.priceLabel} {marker.currency}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
