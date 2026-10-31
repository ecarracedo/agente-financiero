import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/http'
import { AlertsPanel } from './AlertsPanel'
import { alertApi } from './alertApi'

vi.mock('./alertApi', () => ({
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

describe('AlertsPanel', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('saves a portfolio alert with the selected intent and target', async () => {
    const onTargetConfigured = vi.fn()
    vi.mocked(alertApi.configurePortfolio).mockResolvedValue({ configured: true })

    render(
      <AlertsPanel
        ticker="AAPL"
        currency="USD"
        broker="IBKR"
        category="Stock"
        scope="portfolio"
        onTargetConfigured={onTargetConfigured}
      />,
    )

    fireEvent.change(screen.getByLabelText('Intent'), { target: { value: 'STOP_LOSS' } })
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '140.00' } })
    fireEvent.click(screen.getByRole('button', { name: /save alert/i }))

    await waitFor(() =>
      expect(alertApi.configurePortfolio).toHaveBeenCalledWith('AAPL', {
        broker: 'IBKR',
        category: 'Stock',
        target_price: '140.00',
        intent: 'STOP_LOSS',
      }),
    )
    expect(onTargetConfigured).toHaveBeenCalledWith('AAPL', '140.00')
    expect(await screen.findByText(/alert saved/i)).toBeInTheDocument()
  })

  it('shows the backend message when the check returns a crossing event', async () => {
    vi.mocked(alertApi.checkPortfolio).mockResolvedValue({
      current_price: '305.00',
      event: { intent: 'SELL', message: 'Precio objetivo de venta alcanzado.' },
    })

    render(
      <AlertsPanel ticker="AAPL" currency="USD" broker="IBKR" category="Stock" scope="portfolio" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /check alert/i }))

    expect(
      await screen.findByText('Precio objetivo de venta alcanzado.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/305\.00 USD/)).toBeInTheDocument()
  })

  it('reports no crossing when the check returns no event', async () => {
    vi.mocked(alertApi.checkPortfolio).mockResolvedValue({
      current_price: '150.00',
      event: null,
    })

    render(
      <AlertsPanel ticker="AAPL" currency="USD" broker="IBKR" category="Stock" scope="portfolio" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /check alert/i }))

    expect(await screen.findByText(/no crossing/i)).toBeInTheDocument()
  })

  it('shows unavailable, never zero, when the market price is missing (503)', async () => {
    vi.mocked(alertApi.checkPortfolio).mockRejectedValue(
      new ApiError(503, 'market price unavailable'),
    )

    render(
      <AlertsPanel ticker="AAPL" currency="USD" broker="IBKR" category="Stock" scope="portfolio" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /check alert/i }))

    expect(await screen.findByText(/not available/i)).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('uses the wishlist endpoints when the scope is a wishlist entry', async () => {
    vi.mocked(alertApi.configureWishlist).mockResolvedValue({ configured: true })
    vi.mocked(alertApi.checkWishlist).mockResolvedValue({
      current_price: '310.00',
      event: { intent: 'NEUTRAL', message: 'Precio objetivo alcanzado.' },
    })

    render(<AlertsPanel ticker="MSFT" currency={null} scope="wishlist" />)

    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '300.00' } })
    fireEvent.click(screen.getByRole('button', { name: /save alert/i }))

    await waitFor(() =>
      expect(alertApi.configureWishlist).toHaveBeenCalledWith('MSFT', {
        target_price: '300.00',
        intent: 'NEUTRAL',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /check alert/i }))

    await waitFor(() => expect(alertApi.checkWishlist).toHaveBeenCalledWith('MSFT'))
    expect(await screen.findByText('Precio objetivo alcanzado.')).toBeInTheDocument()
  })

  it('labels the observed price with its single currency and never sums currencies', async () => {
    vi.mocked(alertApi.checkPortfolio).mockResolvedValue({
      current_price: '150.00',
      event: null,
    })

    render(
      <AlertsPanel ticker="AAPL" currency="USD" broker="IBKR" category="Stock" scope="portfolio" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /check alert/i }))

    expect(await screen.findByText(/150\.00 USD/)).toBeInTheDocument()
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument()
  })

  it('shows a message and sends nothing when the target price is empty', async () => {
    render(<AlertsPanel ticker="MSFT" currency={null} scope="wishlist" />)

    fireEvent.click(screen.getByRole('button', { name: /save alert/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Target price is required.')
    expect(alertApi.configureWishlist).not.toHaveBeenCalled()
    expect(screen.queryByText('Alert saved.')).not.toBeInTheDocument()
  })
})
