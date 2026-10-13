import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { api } from './api/client'
import { bibliographyApi } from './features/bibliography/bibliographyApi'
import { marketApi } from './features/market/marketApi'
import { wishlistApi } from './features/wishlist/wishlistApi'

vi.mock('./api/client', () => ({
  api: {
    health: vi.fn(),
    ready: vi.fn(),
    listPortfolio: vi.fn(),
    getValuations: vi.fn(),
    listTransactions: vi.fn(),
    createTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}))

vi.mock('./features/market/marketApi', () => ({
  MARKET_PERIODS: ['1mo', '3mo', '6mo', '1y', '2y', '5y'],
  marketApi: {
    listPortfolio: vi.fn(),
    listTransactions: vi.fn(),
    listWishlist: vi.fn(),
    getAnalysis: vi.fn(),
  },
}))

vi.mock('./features/alerts/alertApi', () => ({
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

vi.mock('./features/wishlist/wishlistApi', () => ({
  wishlistApi: {
    list: vi.fn(),
    add: vi.fn(),
    setTarget: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('./features/bibliography/bibliographyApi', () => ({
  bibliographyApi: {
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('./features/tools/split/splitApi', () => ({
  splitApi: {
    calculate: vi.fn(),
  },
}))

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.ready).mockResolvedValue({ status: 'ready' })
    vi.mocked(api.listPortfolio).mockResolvedValue([])
    vi.mocked(api.getValuations).mockResolvedValue([])
    vi.mocked(wishlistApi.list).mockResolvedValue([])
    vi.mocked(bibliographyApi.list).mockResolvedValue([])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders the application shell heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /financial agent/i })).toBeInTheDocument()
  })

  it('shows the readiness reported by the client', async () => {
    render(<App />)

    expect(await screen.findByText(/backend: ready/i)).toBeInTheDocument()
  })

  it('shows the checking state while readiness is pending, then settles', async () => {
    let resolveReady: (value: { status: string }) => void = () => {}
    vi.mocked(api.ready).mockReturnValue(
      new Promise((resolve) => {
        resolveReady = resolve
      }),
    )

    render(<App />)

    expect(screen.getByText('Backend: loading')).toBeInTheDocument()
    expect(screen.queryByText(/backend: ready/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/backend: unavailable/i)).not.toBeInTheDocument()

    resolveReady({ status: 'ready' })

    expect(await screen.findByText(/backend: ready/i)).toBeInTheDocument()
    expect(screen.queryByText(/backend: loading/i)).not.toBeInTheDocument()
  })

  it('renders without a real backend when the client request fails', async () => {
    vi.mocked(api.ready).mockRejectedValue(new Error('network down'))

    render(<App />)

    expect(await screen.findByText(/backend: unavailable/i)).toBeInTheDocument()
  })

  it('switches between the portfolio and transactions workspaces', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Portfolio' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Transactions' }))

    expect(
      await screen.findByRole('heading', { name: 'Transactions' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record operation/i })).toBeInTheDocument()
  })

  it('refetches the portfolio after a transaction is recorded from the shell', async () => {
    vi.mocked(api.createTransaction).mockResolvedValue({
      ticker: 'AAPL',
      broker: 'IBKR',
      category: 'Stock',
      quantity: '5',
      average_price: '120.00',
      currency: 'USD',
    })
    vi.mocked(api.listTransactions).mockResolvedValue([])

    render(<App />)

    await screen.findByRole('heading', { name: 'Portfolio' })
    await waitFor(() => expect(api.listPortfolio).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Transactions' }))
    await screen.findByRole('heading', { name: 'Transactions' })

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: 'IBKR' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Stock' } })
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '120.00' } })
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } })
    fireEvent.change(screen.getByLabelText('Occurred at'), {
      target: { value: '2024-02-01T10:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /record operation/i }))

    expect(await screen.findByText('Operation recorded.')).toBeInTheDocument()
    expect(api.createTransaction).toHaveBeenCalledTimes(1)

    vi.mocked(api.listPortfolio).mockResolvedValue([
      {
        ticker: 'AAPL',
        broker: 'IBKR',
        category: 'Stock',
        quantity: '5',
        average_price: '120.00',
        currency: 'USD',
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Portfolio' }))

    expect(await screen.findByRole('cell', { name: 'AAPL' })).toBeInTheDocument()
    expect(api.listPortfolio).toHaveBeenCalledTimes(2)
  })

  it('opens the market workspace with its chart controls', async () => {
    vi.mocked(marketApi.listPortfolio).mockResolvedValue([])
    vi.mocked(marketApi.listWishlist).mockResolvedValue([])

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Market' }))

    expect(await screen.findByRole('heading', { name: 'Market' })).toBeInTheDocument()
    expect(screen.getByLabelText('Period')).toBeInTheDocument()
    expect(screen.getByLabelText('Chart mode')).toBeInTheDocument()
  })

  it('opens the wishlist workspace', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Wishlist' }))

    expect(await screen.findByRole('heading', { name: 'Wishlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add ticker/i })).toBeInTheDocument()
  })

  it('opens the bibliography workspace', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Bibliography' }))

    expect(await screen.findByRole('heading', { name: 'Bibliography' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
  })

  it('opens the split calculator', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Tools' }))

    expect(
      await screen.findByRole('heading', { name: 'Split calculator' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Ratio')).toBeInTheDocument()
  })
})
