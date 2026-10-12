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

/** Fixed chart geometry keeps rendering deterministic and test-friendly. */
const CHART_WIDTH = 640
const CHART_HEIGHT = 320

export type ChartMode = 'line' | 'area'

export interface MarketChartProps {
  /** Chronological price series geometry. */
  series: ChartPoint[]
  /** Histogram style: a line or a filled area. */
  mode: ChartMode
  /** Target line value for the selected item, or `null` when unset. */
  targetPrice?: number | null
  /** Canonical target label rendered beside the target line. */
  targetLabel?: string | null
  /** Transaction markers for the selected position. */
  markers?: TransactionMarker[]
}

/** Format a timestamp tick as an ISO date without a time component. */
function formatTick(value: number): string {
  return new Date(value).toISOString().slice(0, 10)
}

/**
 * Render the price series, an optional target line, and transaction markers.
 *
 * Monetary values are shown through canonical strings in the marker list;
 * the SVG itself only uses numeric geometry.
 */
export function MarketChart({
  series,
  mode,
  targetPrice = null,
  targetLabel = null,
  markers = [],
}: MarketChartProps) {
  const yDomain = toValueDomain(
    series.map((point) => point.close),
    targetPrice,
  )

  return (
    <div data-testid="market-chart">
      <ComposedChart width={CHART_WIDTH} height={CHART_HEIGHT} data={series}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatTick}
        />
        <YAxis domain={yDomain} />
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
