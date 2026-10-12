import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MarketWorkspace } from './MarketWorkspace'
import { marketApi } from './marketApi'

vi.mock('./marketApi', () => ({
  MARKET_PERIODS: ['1mo', '3mo', '6mo', '1y', '2y', '5y'],
  marketApi: {
    listPortfolio: vi.fn(),
    listTransactions: vi.fn(),
    listWishlist: vi.fn(),
    getAnalysis: vi.fn(),
  },
}))

vi.mock('../alerts/alertApi', () => ({
  ALERT_INTENTS: [
    { value: 'NEUTRAL', label: 'Neutral' },
    { value: 'STOP_LOSS', label: 'Stop-loss' },
    { value: 'BUY', label: 'Buy' },
    { value: 'SELL', label: 'Sell' },
  ],
  alertApi: {
    configurePortfolio: vi.fn(),
    checkPortfolio: vi.fn(),
    configureWishlist: vi.fn(),
    checkWishlist: vi.fn(),
  },
}))

const portfolio = [
  {
    ticker: 'AAPL',
    broker: 'IBKR',
    category: 'Stock',
    quantity: '10',
    average_price: '150.25',
    currency: 'USD',
  },
]

const wishlist = [{ ticker: 'MSFT', target_price: '300.00' }]

const transaction = {
  id: 7,
  ticker: 'AAPL',
  broker: 'IBKR',
  category: 'Stock',
  operation_type: 'BUY',
  quantity: '5',
  unit_price: '120.00',
  currency: 'USD',
  occurred_at: '2024-02-01T10:00:00',
}

const knownAnalysis = {
  ticker: 'AAPL',
  status: 'OK',
  reason: null,
  current_price: '190.00',
  high_52_week: '200.00',
  low_52_week: '150.00',
  moving_average_50: '180.00',
  moving_average_200: null,
  signals: ['NEAR_52_WEEK_HIGH'],
  series: [
    { date: '2024-01-01', close: '160.00' },
    { date: '2024-02-01', close: '175.00' },
    { date: '2024-03-01', close: '190.00' },
  ],
}

const unknownAnalysis = {
  ticker: 'ZZZZ',
  status: 'UNKNOWN',
  reason: 'No current market price',
  current_price: null,
  high_52_week: null,
  low_52_week: null,
  moving_average_50: null,
  moving_average_200: null,
  signals: [],
  series: [],
}

describe('MarketWorkspace', () => {
  beforeEach(() => {
    vi.mocked(marketApi.listPortfolio).mockResolvedValue(portfolio)
    vi.mocked(marketApi.listWishlist).mockResolvedValue(wishlist)
    vi.mocked(marketApi.listTransactions).mockResolvedValue([transaction])
    vi.mocked(marketApi.getAnalysis).mockResolvedValue(knownAnalysis)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders the series and a target overlay for a wishlist target', async () => {
    vi.mocked(marketApi.getAnalysis).mockImplementation(async (ticker: string) =>
      ticker === 'MSFT'
        ? { ...knownAnalysis, ticker: 'MSFT', signals: [] }
        : knownAnalysis,
    )

    const { container } = render(<MarketWorkspace />)

    // Default selection is the first portfolio holding.
    expect(await screen.findByTestId('market-chart')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'MSFT' } })

    await waitFor(() =>
      expect(container.querySelector('.recharts-reference-line')).not.toBeNull(),
    )
  })

  it('draws transaction markers for the selected position', async () => {
    render(<MarketWorkspace />)

    expect(await screen.findByTestId('market-chart')).toBeInTheDocument()
    await waitFor(() => expect(marketApi.listTransactions).toHaveBeenCalledWith('AAPL', 'IBKR'))

    expect(screen.getByText(/2024-02-01/)).toBeInTheDocument()
    expect(screen.getByText(/120\.00 USD/)).toBeInTheDocument()
  })

  it('shows an explicit unavailable state for unknown analysis instead of zero', async () => {
    vi.mocked(marketApi.getAnalysis).mockResolvedValue(unknownAnalysis)

    render(<MarketWorkspace />)

    expect(await screen.findByText(/not available/i)).toBeInTheDocument()
    expect(screen.queryByTestId('market-chart')).not.toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('refetches the analysis when the period changes', async () => {
    render(<MarketWorkspace />)

    await screen.findByTestId('market-chart')

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '5y' } })

    await waitFor(() =>
      expect(marketApi.getAnalysis).toHaveBeenCalledWith('AAPL', '5y'),
    )
  })

  it('switches the chart mode between line and area', async () => {
    const { container } = render(<MarketWorkspace />)

    await screen.findByTestId('market-chart')
    expect(container.querySelector('.recharts-line-curve')).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Chart mode'), { target: { value: 'area' } })

    await waitFor(() =>
      expect(container.querySelector('.recharts-area-area')).not.toBeNull(),
    )
  })

  it('loads a free-text ticker via the search control', async () => {
    render(<MarketWorkspace />)

    await screen.findByTestId('market-chart')

    fireEvent.change(screen.getByLabelText('Search ticker'), { target: { value: 'msft' } })
    fireEvent.click(screen.getByRole('button', { name: /load ticker/i }))

    await waitFor(() => expect(marketApi.getAnalysis).toHaveBeenCalledWith('MSFT', '1y'))
  })
})
