import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { portfolioItems } from '../../mocks/fixtures'
import { server } from '../../../tests/setup'
import { renderWithRouter } from '../../../tests/render'

/**
 * PortfolioWorkspace against the MSW harness.
 *
 * There is no `vi.mock` here: requests go to MSW, which serves the shared
 * fixtures through the real client. That makes this file a check on the harness
 * itself as well as on the view, so a fixture that stops matching the contract
 * fails here instead of rendering `undefined` in a cell.
 *
 * Loading and failure are still covered: `server.use` replaces a handler for one
 * test, which is how the pending and rejected paths are reached now that the
 * client is real.
 */
describe('PortfolioWorkspace', () => {
  it('renders holdings with quantity, average price, and their currency', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    // Both fixture positions share the IBKR broker, so the assertions are
    // scoped to one row: the point is that the fields belong to the same holding.
    const tickerCell = await screen.findByRole('cell', { name: 'AAPL' })
    const row = within(tickerCell.closest('tr') as HTMLElement)

    expect(row.getByRole('cell', { name: 'IBKR' })).toBeInTheDocument()
    expect(row.getByRole('cell', { name: 'Stock' })).toBeInTheDocument()
    expect(row.getByRole('cell', { name: '10' })).toBeInTheDocument()
    expect(row.getByRole('cell', { name: '150.25 USD' })).toBeInTheDocument()
  })

  it('renders each currency as a separate valuation group, never summed together', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    const usdCell = await screen.findByRole('cell', { name: 'USD' })
    const eurCell = screen.getByRole('cell', { name: 'EUR' })
    const usdRow = within(usdCell.closest('tr') as HTMLElement)
    const eurRow = within(eurCell.closest('tr') as HTMLElement)

    expect(usdRow.getByRole('cell', { name: '2902.50 USD' })).toBeInTheDocument()
    expect(usdRow.queryByText(/EUR/)).not.toBeInTheDocument()
    expect(eurRow.getByRole('cell', { name: '1200.00 EUR' })).toBeInTheDocument()
    expect(eurRow.queryByText(/USD/)).not.toBeInTheDocument()
  })

  it('renders "Not available" for missing market values instead of zero', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    // The EUR fixture has a null valuation across three fields.
    const eurCell = await screen.findByRole('cell', { name: 'EUR' })
    const eurRow = within(eurCell.closest('tr') as HTMLElement)

    expect(eurRow.getAllByText(/not available/i)).toHaveLength(3)
    expect(eurRow.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders a gain/loss percentage as the backend sent it, with one percent sign', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    // `gain_loss_percent` arrives as a bare magnitude ('17.14'), never with a
    // leading '+', so the cell must not invent one and must not double the '%'.
    const usdCell = await screen.findByRole('cell', { name: 'USD' })
    const usdRow = within(usdCell.closest('tr') as HTMLElement)

    expect(usdRow.getByRole('cell', { name: '17.14%' })).toBeInTheDocument()
  })

  it('shows the counts the backend reported inside a styled card', async () => {
    const { container } = renderWithRouter({ initialEntries: ['/portfolio'] })

    const currencies = await screen.findByText('Currencies')
    expect(currencies.nextElementSibling).toHaveTextContent('2')

    // Three sections, each on the shared styling system: summary, holdings,
    // valuations. Unstyled raw HTML would carry no Tremor marker at all.
    expect(container.querySelectorAll('[tremor-id="tremor-raw"]').length).toBeGreaterThanOrEqual(3)
  })

  it('shows a loading state while the request is pending', async () => {
    server.use(
      http.get('*/api/v1/portfolio', () => new Promise<never>(() => {})),
      http.get('*/api/v1/valuations', () => new Promise<never>(() => {})),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    // Named specifically: the shell's backend indicator is also role="status".
    expect(await screen.findByText('Loading portfolio…')).toBeInTheDocument()
  })

  it('shows an error state when the backend request fails', async () => {
    server.use(
      http.get('*/api/v1/portfolio', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('executes a transaction from QuickOrderCard and triggers portfolio refresh', async () => {
    let portfolioFetchCount = 0
    let posted: Record<string, unknown> | null = null
    server.use(
      http.get('*/api/v1/portfolio', () => {
        portfolioFetchCount++
        return HttpResponse.json(portfolioItems)
      }),
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null, { status: 201 })
      }),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })
    await screen.findByRole('heading', { name: /posiciones en cartera/i })

    const initialCount = portfolioFetchCount

    // The unit price is autocompleted from the quote before the order is sent.
    await waitFor(() => {
      expect(screen.getByLabelText('Precio / Acción')).toHaveValue('190.00')
    })

    // Submit quick order
    const registerBtn = screen.getByRole('button', { name: /registrar transacción/i })
    fireEvent.click(registerBtn)

    // Check confirmation feedback and refetch
    expect(await screen.findByText('¡Transacción Registrada!')).toBeInTheDocument()
    await waitFor(() => {
      expect(portfolioFetchCount).toBeGreaterThan(initialCount)
    })

    expect(posted).toMatchObject({
      ticker: 'NVDA',
      operation_type: 'BUY',
      quantity: '10',
      unit_price: '190.00',
      currency: 'USD',
    })
  })
})
