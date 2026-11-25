import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarketChart } from './MarketChart'
import type { ChartPoint, TransactionMarker } from './series'

const series: ChartPoint[] = [
  { date: '2024-01-01', timestamp: Date.parse('2024-01-01'), close: 160, closeLabel: '160.00' },
  { date: '2024-02-01', timestamp: Date.parse('2024-02-01'), close: 175.5, closeLabel: '175.50' },
  { date: '2024-03-01', timestamp: Date.parse('2024-03-01'), close: 190, closeLabel: '190.00' },
]

const seriesWithRange: ChartPoint[] = [
  {
    date: '2024-01-01',
    timestamp: Date.parse('2024-01-01'),
    close: 160,
    closeLabel: '160.00',
    range: [155, 165],
  },
  { date: '2024-02-01', timestamp: Date.parse('2024-02-01'), close: 175.5, closeLabel: '175.50' },
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

  it('draws a labelled last-close reference line when provided', () => {
    render(
      <MarketChart
        series={series}
        mode="line"
        lastClosePrice={190}
        lastCloseLabel="$ 190,00"
      />,
    )

    expect(screen.queryAllByTestId('last-close-line').length).toBeGreaterThan(0)
    expect(within(screen.getByTestId('market-chart')).getByText('$ 190,00')).toBeInTheDocument()
  })

  it('draws the last-close line solid with its label outside the plot', () => {
    render(
      <MarketChart
        series={series}
        mode="line"
        width={800}
        lastClosePrice={190}
        lastCloseLabel="$ 190,00"
      />,
    )

    const chart = screen.getByTestId('market-chart')
    const line = Array.from(chart.querySelectorAll('line')).find(
      (candidate) => candidate.getAttribute('stroke') === '#4cd7f6',
    )
    expect(line).toBeDefined()
    expect(line).not.toHaveAttribute('stroke-dasharray')

    const label = within(chart).getByText('$ 190,00')
    const labelX = Number(label.getAttribute('x') ?? label.closest('text')?.getAttribute('x'))
    expect(labelX).toBeGreaterThan(700)
  })

  it('omits the last-close line when no price is provided', () => {
    render(<MarketChart series={series} mode="line" />)

    expect(screen.queryByTestId('last-close-line')).not.toBeInTheDocument()
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

  it('uses the card mono token for axis labels', () => {
    render(<MarketChart series={series} mode="line" />)

    const ticks = Array.from(screen.getByTestId('market-chart').querySelectorAll('svg text'))
    expect(ticks.length).toBeGreaterThan(0)
    expect(
      ticks.some(
        (tick) =>
          tick.getAttribute('fill') === '#869397' &&
          tick.getAttribute('font-size') === '10' &&
          (tick.getAttribute('font-family') ?? '').includes('JetBrains Mono'),
      ),
    ).toBe(true)
  })

  it('honors an explicit chart width', () => {
    render(<MarketChart series={series} mode="line" width={800} />)

    expect(screen.getByTestId('market-chart').querySelector('svg')).toHaveAttribute('width', '800')
  })

  it('draws the high-low band only when the series carries ranges', () => {
    const { rerender } = render(<MarketChart series={series} mode="line" />)
    expect(screen.queryByTestId('price-range-band')).not.toBeInTheDocument()

    rerender(<MarketChart series={seriesWithRange} mode="line" />)
    expect(screen.queryAllByTestId('price-range-band').length).toBeGreaterThan(0)
  })
})
