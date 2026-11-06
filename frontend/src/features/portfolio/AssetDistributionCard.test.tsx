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
