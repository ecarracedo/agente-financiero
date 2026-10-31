import { render, screen, within } from '@testing-library/react'
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
    render(<MarketChart series={series} mode="line" />)

    const chart = screen.getByTestId('market-chart')
    expect(chart.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('application')).toBeInTheDocument()
  })

  it('renders the same chart surface when the chart mode is area', () => {
    render(<MarketChart series={series} mode="area" />)

    expect(screen.getByTestId('market-chart').querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('application')).toBeInTheDocument()
  })

  it('shows the target label when a target price is configured', () => {
    render(<MarketChart series={series} mode="line" targetPrice={180} targetLabel="180.00 USD" />)

    expect(screen.getByText('180.00 USD')).toBeInTheDocument()
  })

  it('omits the target label when no target price is configured', () => {
    render(<MarketChart series={series} mode="line" targetPrice={null} targetLabel="180.00 USD" />)

    expect(screen.queryByText('180.00 USD')).not.toBeInTheDocument()
  })

  it('lists one canonical entry per transaction marker', () => {
    render(<MarketChart series={series} mode="line" markers={markers} />)

    const list = screen.getByRole('list', { name: 'Transaction markers' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('2024-02-01 · BUY · 120.00 USD')
  })

  it('omits the marker list when there are no transactions', () => {
    render(<MarketChart series={series} mode="line" />)

    expect(screen.queryByRole('list', { name: 'Transaction markers' })).not.toBeInTheDocument()
  })
})
