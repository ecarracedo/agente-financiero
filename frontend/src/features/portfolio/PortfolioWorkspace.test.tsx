import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CurrencyValuation, PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'
import { PortfolioWorkspace } from './PortfolioWorkspace'

vi.mock('../../api/client', () => ({
  api: {
    listPortfolio: vi.fn(),
    getValuations: vi.fn(),
  },
}))

const positions: PortfolioPosition[] = [
  {
    ticker: 'AAPL',
    broker: 'IBKR',
    category: 'Stock',
    quantity: '10',
    average_price: '150.25',
    currency: 'USD',
  },
]

const valuations: CurrencyValuation[] = [
  {
    currency: 'USD',
    invested_value: '1502.50',
    market_value: '1700.00',
    gain_loss: '197.50',
    gain_loss_percent: '13.14',
    unpriced_tickers: [],
  },
  {
    currency: 'EUR',
    invested_value: '500.00',
    market_value: null,
    gain_loss: null,
    gain_loss_percent: null,
    unpriced_tickers: ['SAP'],
  },
]

describe('PortfolioWorkspace', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders holdings with quantity, average price, and their currency', async () => {
    vi.mocked(api.listPortfolio).mockResolvedValue(positions)
    vi.mocked(api.getValuations).mockResolvedValue(valuations)

    render(<PortfolioWorkspace />)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('IBKR')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('150.25 USD')).toBeInTheDocument()
  })

  it('renders each currency as a separate valuation group, never summed together', async () => {
    vi.mocked(api.listPortfolio).mockResolvedValue(positions)
    vi.mocked(api.getValuations).mockResolvedValue(valuations)

    render(<PortfolioWorkspace />)

    const usdCell = await screen.findByRole('cell', { name: 'USD' })
    const eurCell = screen.getByRole('cell', { name: 'EUR' })
    const usdRow = within(usdCell.closest('tr') as HTMLElement)
    const eurRow = within(eurCell.closest('tr') as HTMLElement)

    expect(usdRow.getByRole('cell', { name: '1502.50 USD' })).toBeInTheDocument()
    expect(usdRow.queryByText(/EUR/)).not.toBeInTheDocument()
    expect(eurRow.getByRole('cell', { name: '500.00 EUR' })).toBeInTheDocument()
    expect(eurRow.queryByText(/USD/)).not.toBeInTheDocument()
  })

  it('renders "Not available" for missing market values instead of zero', async () => {
    vi.mocked(api.listPortfolio).mockResolvedValue([])
    vi.mocked(api.getValuations).mockResolvedValue([valuations[1]])

    render(<PortfolioWorkspace />)

    expect(await screen.findByRole('cell', { name: 'EUR' })).toBeInTheDocument()
    expect(screen.getAllByText(/not available/i)).toHaveLength(3)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('refetches when refreshToken changes and not when it stays the same', async () => {
    vi.mocked(api.listPortfolio).mockResolvedValue(positions)
    vi.mocked(api.getValuations).mockResolvedValue(valuations)

    const { rerender } = render(<PortfolioWorkspace refreshToken={0} />)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(api.listPortfolio).toHaveBeenCalledTimes(1)
    expect(api.getValuations).toHaveBeenCalledTimes(1)

    rerender(<PortfolioWorkspace refreshToken={0} />)
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(api.listPortfolio).toHaveBeenCalledTimes(1)
    expect(api.getValuations).toHaveBeenCalledTimes(1)

    vi.mocked(api.listPortfolio).mockResolvedValue([{ ...positions[0], ticker: 'MSFT' }])
    rerender(<PortfolioWorkspace refreshToken={1} />)

    expect(await screen.findByText('MSFT')).toBeInTheDocument()
    expect(api.listPortfolio).toHaveBeenCalledTimes(2)
    expect(api.getValuations).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
  })

  it('shows a loading state while data is pending', () => {
    vi.mocked(api.listPortfolio).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getValuations).mockReturnValue(new Promise(() => {}))

    render(<PortfolioWorkspace />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state when the backend request fails', async () => {
    vi.mocked(api.listPortfolio).mockRejectedValue(new Error('boom'))
    vi.mocked(api.getValuations).mockResolvedValue([])

    render(<PortfolioWorkspace />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
