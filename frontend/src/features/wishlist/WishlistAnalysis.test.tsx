import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/http'
import { WishlistWorkspace } from './WishlistWorkspace'
import { wishlistApi } from './wishlistApi'

vi.mock('./wishlistApi', () => ({
  wishlistApi: {
    list: vi.fn(),
    add: vi.fn(),
    setTarget: vi.fn(),
    remove: vi.fn(),
    history: vi.fn(),
  },
}))

const history = {
  ticker: 'AAPL',
  period: '3mo',
  points: [
    { date: '2024-01-31', close: '100' },
    { date: '2024-02-29', close: '1234.5' },
  ],
  monthly_variation_percent: '12.5',
  period_variation_percent: '-3',
}

async function openAnalysis() {
  vi.mocked(wishlistApi.list).mockResolvedValue([{ ticker: 'AAPL', target_price: null }])
  render(<WishlistWorkspace />)
  await screen.findByText('AAPL')
  fireEvent.click(screen.getByRole('button', { name: /analyze aapl/i }))
}

describe('WishlistAnalysis', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows no analysis card until a row is analyzed', async () => {
    vi.mocked(wishlistApi.list).mockResolvedValue([{ ticker: 'AAPL', target_price: null }])
    render(<WishlistWorkspace />)

    await screen.findByText('AAPL')

    expect(screen.queryByTestId('wishlist-analysis')).not.toBeInTheDocument()
    expect(wishlistApi.history).not.toHaveBeenCalled()
  })

  it('loads the 3M history, renders the chart and es-AR formatted variations', async () => {
    vi.mocked(wishlistApi.history).mockResolvedValue(history)

    await openAnalysis()

    expect(screen.getByText(/loading history/i)).toBeInTheDocument()
    expect(await screen.findByTestId('market-chart')).toBeInTheDocument()
    expect(wishlistApi.history).toHaveBeenCalledWith('AAPL', '3mo')
    expect(screen.getByText('+12,50%')).toBeInTheDocument()
    expect(screen.getByText('-3,00%')).toBeInTheDocument()
    expect(screen.getAllByText('$ 1.234,50')).toHaveLength(2)
  })

  it('renders the wider chart in the analysis card', async () => {
    vi.mocked(wishlistApi.history).mockResolvedValue(history)

    await openAnalysis()
    const chart = await screen.findByTestId('market-chart')

    expect(chart.querySelector('svg')).toHaveAttribute('width', '800')
  })

  it('labels the last close on the chart with the canonical money string', async () => {
    vi.mocked(wishlistApi.history).mockResolvedValue(history)

    await openAnalysis()
    const chart = await screen.findByTestId('market-chart')

    expect(within(chart).getByText('$ 1.234,50')).toBeInTheDocument()
  })

  it('renders the high-low band when the history carries daily extremes', async () => {
    vi.mocked(wishlistApi.history).mockResolvedValue({
      ...history,
      points: [
        { date: '2024-01-31', close: '100', high: '104', low: '97' },
        { date: '2024-02-29', close: '1234.5', high: '1260', low: '1200' },
      ],
    })

    await openAnalysis()
    await screen.findByTestId('market-chart')

    expect(screen.queryAllByTestId('price-range-band').length).toBeGreaterThan(0)
  })

  it('reloads with the provider period when the selector changes', async () => {
    vi.mocked(wishlistApi.history).mockResolvedValue(history)

    await openAnalysis()
    await screen.findByTestId('market-chart')
    fireEvent.click(screen.getByRole('button', { name: '12M' }))

    await waitFor(() => expect(wishlistApi.history).toHaveBeenLastCalledWith('AAPL', '1y'))
    fireEvent.click(screen.getByRole('button', { name: '6M' }))
    await waitFor(() => expect(wishlistApi.history).toHaveBeenLastCalledWith('AAPL', '6mo'))
  })

  it('shows an explicit empty state and null variations as a dash', async () => {
    vi.mocked(wishlistApi.history).mockResolvedValue({
      ...history,
      points: [],
      monthly_variation_percent: null,
      period_variation_percent: null,
    })

    await openAnalysis()

    expect(await screen.findByText(/no price history/i)).toBeInTheDocument()
    expect(screen.queryByTestId('market-chart')).not.toBeInTheDocument()
  })

  it('surfaces a failed history request as an alert', async () => {
    vi.mocked(wishlistApi.history).mockRejectedValue(new ApiError(404, 'not found'))

    await openAnalysis()

    expect(await screen.findByRole('alert')).toHaveTextContent(/404/)
    expect(screen.queryByTestId('market-chart')).not.toBeInTheDocument()
  })
})
