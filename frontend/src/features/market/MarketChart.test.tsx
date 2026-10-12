import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarketChart } from './MarketChart'
import type { ChartPoint, TransactionMarker } from './series'

const series: ChartPoint[] = [
  { date: '2024-01-01', timestamp: Date.parse('2024-01-01'), close: 160, closeLabel: '160.00' },
  { date: '2024-02-01', timestamp: Date.parse('2024-02-01'), close: 175.5, closeLabel: '175.50' },
  { date: '2024-03-01', timestamp: Date.parse('2024-03-01'), close: 190, closeLabel: '190.00' },
]

const markers: TransactionMarker[] = [
  {
    id: 7,
    date: '2024-02-01',
    timestamp: Date.parse('2024-02-01'),
    price: 120,
    priceLabel: '120.00',
    operationType: 'BUY',
    currency: 'USD',
  },
]

describe('MarketChart', () => {
  it('renders the price series as an SVG line chart', () => {
    const { container } = render(<MarketChart series={series} mode="line" />)

    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.recharts-line-curve')).not.toBeNull()
  })

  it('renders an area series when the chart mode is area', () => {
    const { container } = render(<MarketChart series={series} mode="area" />)

    expect(container.querySelector('.recharts-area-area')).not.toBeNull()
  })

  it('draws a target overlay when a target price is configured', () => {
    const { container } = render(
      <MarketChart series={series} mode="line" targetPrice={180} targetLabel="180.00 USD" />,
    )

    expect(container.querySelector('.recharts-reference-line')).not.toBeNull()
  })

  it('omits the target overlay when no target price is configured', () => {
    const { container } = render(<MarketChart series={series} mode="line" targetPrice={null} />)

    expect(container.querySelector('.recharts-reference-line')).toBeNull()
  })

  it('draws one marker symbol per transaction and lists canonical values', () => {
    const { container } = render(
      <MarketChart series={series} mode="line" markers={markers} />,
    )

    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(1)
    expect(container.querySelector('[aria-label="Transaction markers"]')).not.toBeNull()
    expect(container.textContent).toContain('2024-02-01')
    expect(container.textContent).toContain('BUY')
    expect(container.textContent).toContain('120.00 USD')
  })
})
