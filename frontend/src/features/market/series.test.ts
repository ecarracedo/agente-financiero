import { describe, expect, it } from 'vitest'

import type { TransactionSummary } from '../../api/client'
import type { PricePoint } from './series'
import { toChartSeries, toTargetValue, toTransactionMarkers, toValueDomain } from './series'

const points: PricePoint[] = [
  { date: '2024-01-01', close: '160.00' },
  { date: '2024-02-01', close: '175.50' },
]

const transactions: TransactionSummary[] = [
  {
    id: 7,
    ticker: 'AAPL',
    broker: 'IBKR',
    category: 'Stock',
    operation_type: 'BUY',
    quantity: '5',
    unit_price: '120.00',
    currency: 'USD',
    occurred_at: '2024-02-01T10:00:00',
  },
]

describe('series helpers', () => {
  it('maps closing points to chart geometry while keeping the canonical string', () => {
    const chart = toChartSeries(points)

    expect(chart).toHaveLength(2)
    expect(chart[0].closeLabel).toBe('160.00')
    expect(chart[0].close).toBe(160)
    expect(chart[1].closeLabel).toBe('175.50')
    expect(chart[0].timestamp).toBe(Date.parse('2024-01-01'))
  })

  it('parses a target price for geometry and yields null when unset', () => {
    expect(toTargetValue('300.00')).toBe(300)
    expect(toTargetValue(null)).toBeNull()
    expect(toTargetValue(undefined)).toBeNull()
    expect(toTargetValue('')).toBeNull()
    expect(toTargetValue('not-a-number')).toBeNull()
  })

  it('maps transactions to markers using the canonical unit price string', () => {
    const markers = toTransactionMarkers(transactions)

    expect(markers).toHaveLength(1)
    expect(markers[0].priceLabel).toBe('120.00')
    expect(markers[0].price).toBe(120)
    expect(markers[0].operationType).toBe('BUY')
    expect(markers[0].date).toBe('2024-02-01')
    expect(markers[0].currency).toBe('USD')
  })

  it('includes a target beyond the price range in the y-domain', () => {
    const [min, max] = toValueDomain([160, 190], 300)

    expect(min).toBeLessThanOrEqual(160)
    expect(max).toBeGreaterThanOrEqual(300)
  })

  it('pads a flat domain so the axis stays renderable', () => {
    const [min, max] = toValueDomain([100], null)

    expect(min).toBeLessThan(100)
    expect(max).toBeGreaterThan(100)
  })
})
