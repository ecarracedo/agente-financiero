import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { analysisAAPL, portfolioItems, unknownAnalysis } from '../../mocks/fixtures'
import { server } from '../../../tests/setup'
import { renderWithRouter } from '../../../tests/render'

/**
 * AssetDistributionCard against the MSW harness.
 *
 * The card must be computed from real portfolio data: the AAPL fixture holds
 * 10 units at a 190.00 market price, so the USD section is $ 1.900,00 with the
 * Acciones category at 100%. The hardcoded mock ($148,650.80, 62%/23%/10%/5%)
 * must be gone.
 */
describe('AssetDistributionCard', () => {
  it('shows the real USD total and category for the fixture holding', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    await within(card).findByText(/Acciones/)

    expect(within(card).getAllByText(/\$ 1\.900,00/).length).toBeGreaterThan(0)
    expect(within(card).getAllByText(/100,0%/).length).toBeGreaterThan(0)
    expect(within(card).queryByText(/148/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/9\.4/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/Efectivo/)).not.toBeInTheDocument()
  })

  it('shows all assets in green when every price is above the average price', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    // AAPL: current 190 > average 150.25 -> 0/1 in red, 1/1 in green.
    const bar = await within(card).findByTitle(/0\/1 en rojo, 1\/1 en verde/)
    expect(bar).toHaveAttribute('aria-label', '0,0% en rojo, 100,0% en verde')
  })

  it('shows the red share when some assets are below their average price', async () => {
    const avg = { ticker: 'MSFT', broker: 'ECO', category: 'Acciones', quantity: '10', average_price: '280.00', currency: 'USD' }
    const loser = { ticker: 'TSLA', broker: 'ECO', category: 'Acciones', quantity: '10', average_price: '250.00', currency: 'USD' }
    server.use(
      http.get('*/api/v1/analysis/:ticker', ({ params }) => {
        if (String(params.ticker) === 'TSLA') {
          return HttpResponse.json({ ...analysisAAPL, current_price: '200.00' })
        }
        return HttpResponse.json({ ...analysisAAPL, current_price: '300.00' })
      }),
      http.get('*/api/v1/portfolio', () =>
        HttpResponse.json([avg, loser]),
      ),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    // MSFT 300 > 280 (green), TSLA 200 < 250 (red) -> 50% red / 50% green.
    const bar = await within(card).findByTitle(/1\/2 en rojo, 1\/2 en verde/)
    expect(bar).toHaveAttribute('aria-label', '50,0% en rojo, 50,0% en verde')
  })

  it('groups by currency and never sums different currencies together', async () => {
    server.use(
      http.get('*/api/v1/portfolio', () =>
        HttpResponse.json([
          ...portfolioItems,
          { ticker: 'PAMP.BA', broker: 'PPI', category: 'Cedear', quantity: '10', average_price: '4000.00', currency: 'ARS' },
        ]),
      ),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    await within(card).findByText(/Cedear/)

    // USD: 10 × 190 = 1.900. ARS: 10 × 4802.50 (analysisPAMP) = 48.025.
    expect(within(card).getAllByText(/\$ 1\.900,00/).length).toBeGreaterThan(0)
    expect(within(card).getAllByText(/\$ 48\.025,00/).length).toBeGreaterThan(0)
  })

  it('excludes unpriced tickers from the total and declares them', async () => {
    server.use(
      http.get('*/api/v1/analysis/:ticker', () => HttpResponse.json(unknownAnalysis)),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    await within(card).findByText(/sin valuar/i)

    expect(within(card).queryByText(/\$ 0/)).not.toBeInTheDocument()
  })

  it('shows an empty state when the portfolio has no positions', async () => {
    server.use(
      http.get('*/api/v1/portfolio', () => HttpResponse.json([])),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    await within(card).findByText(/sin posiciones/i)
  })

  it('follows the latest quote instead of a stale one', async () => {
    let quoteCalls = 0
    server.use(
      http.get('*/api/v1/analysis/:ticker', () => {
        quoteCalls++
        const price = quoteCalls === 1 ? '190.00' : '205.00'
        return HttpResponse.json({ ...analysisAAPL, current_price: price })
      }),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /distribución de activos/i })
    await waitFor(() => {
      expect(within(card).getAllByText(/\$ 2\.050,00/).length).toBeGreaterThan(0)
    })
    expect(within(card).queryByText(/\$ 1\.900,00/)).not.toBeInTheDocument()
  })
})
