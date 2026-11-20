import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AlertsPanel } from './AlertsPanel'
import { alertApi } from './alertApi'

vi.mock('./alertApi', () => ({
  ALERT_INTENTS: [
    { value: 'BUY', label: 'Compra' },
    { value: 'SELL', label: 'Venta' },
  ],
  alertApi: {
    list: vi.fn(),
    configurePortfolio: vi.fn(),
    configureWishlist: vi.fn(),
    deletePortfolio: vi.fn(),
    deleteWishlist: vi.fn(),
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

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'SELL' } })
    fireEvent.change(screen.getByLabelText('Precio objetivo'), { target: { value: '140.00' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar alerta/i }))

    await waitFor(() =>
      expect(alertApi.configurePortfolio).toHaveBeenCalledWith('AAPL', {
        broker: 'IBKR',
        category: 'Stock',
        target_price: '140.00',
        intent: 'SELL',
      }),
    )
    expect(onTargetConfigured).toHaveBeenCalledWith('AAPL', '140.00')
    expect(await screen.findByText(/alerta guardada/i)).toBeInTheDocument()
  })

  it('uses the wishlist endpoints when the scope is a wishlist entry', async () => {
    vi.mocked(alertApi.configureWishlist).mockResolvedValue({ configured: true })

    render(<AlertsPanel ticker="MSFT" currency={null} scope="wishlist" />)

    fireEvent.change(screen.getByLabelText('Precio objetivo'), { target: { value: '300.00' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar alerta/i }))

    await waitFor(() =>
      expect(alertApi.configureWishlist).toHaveBeenCalledWith('MSFT', {
        target_price: '300.00',
        intent: 'BUY',
      }),
    )
  })

  it('prefills the saved alert type and target price', () => {
    render(
      <AlertsPanel
        ticker="AAPL"
        currency="USD"
        broker="IBKR"
        category="Stock"
        scope="portfolio"
        alert={{ target_price: '140.00', intent: 'SELL' }}
      />,
    )

    expect(screen.getByLabelText('Tipo')).toHaveValue('SELL')
    expect(screen.getByLabelText('Precio objetivo')).toHaveValue('140.00')
  })

  it('shows a message and sends nothing when the target price is empty', async () => {
    render(<AlertsPanel ticker="MSFT" currency={null} scope="wishlist" />)

    fireEvent.click(screen.getByRole('button', { name: /guardar alerta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El precio objetivo es obligatorio.')
    expect(alertApi.configureWishlist).not.toHaveBeenCalled()
    expect(screen.queryByText('Alerta guardada.')).not.toBeInTheDocument()
  })
})
