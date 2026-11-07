import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'

import { analysisAAPL, portfolioItems, unknownAnalysis } from '../../mocks/fixtures'
import { CATEGORIES_STORAGE_KEY } from '../settings/catalogSettings'
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

    expect(row.getByDisplayValue('ECO')).toBeInTheDocument()
    expect(row.getByDisplayValue('Acciones')).toBeInTheDocument()
    expect(row.getByRole('cell', { name: '10' })).toBeInTheDocument()
    expect(row.getByText(/150,25/)).toBeInTheDocument()
  })

  it('renders each currency as a separate valuation group, never summed together', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })

    const usdCell = await screen.findByRole('cell', { name: 'USD' })
    const eurCell = screen.getByRole('cell', { name: 'EUR' })
    const usdRow = within(usdCell.closest('tr') as HTMLElement)
    const eurRow = within(eurCell.closest('tr') as HTMLElement)

    expect(usdRow.getByRole('cell', { name: '$ 2.902,50 USD' })).toBeInTheDocument()
    expect(usdRow.queryByText(/EUR/)).not.toBeInTheDocument()
    expect(eurRow.getByRole('cell', { name: '$ 1.200,00 EUR' })).toBeInTheDocument()
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

  it('refreshes quotes when the manual refresh button is used', async () => {
    let quoteCalls = 0
    server.use(
      http.get('*/api/v1/analysis/:ticker', () => {
        quoteCalls++
        const price = quoteCalls === 1 ? '190.00' : '205.00'
        return HttpResponse.json({ ...analysisAAPL, current_price: price })
      }),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })
    await screen.findByRole('heading', { name: /posiciones en cartera/i })

    await waitFor(() => {
      expect(screen.getAllByText('$ 190,00').length).toBeGreaterThan(0)
    })

    const callsBeforeRefresh = quoteCalls
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }))

    await waitFor(() => {
      expect(quoteCalls).toBeGreaterThan(callsBeforeRefresh)
    })
    await waitFor(() => {
      expect(screen.getAllByText('$ 205,00').length).toBeGreaterThan(0)
    })
  })

  it('reverts the broker selector when the update request fails', async () => {
    server.use(
      http.put('*/api/v1/portfolio/:ticker', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const tickerCell = await screen.findByRole('cell', { name: 'AAPL' })
    const row = within(tickerCell.closest('tr') as HTMLElement)
    const brokerSelect = row.getByDisplayValue('ECO')

    fireEvent.change(brokerSelect, { target: { value: 'PPI' } })

    // Optimistic first: the control must not wait for the round-trip.
    expect(row.getByDisplayValue('PPI')).toBeInTheDocument()
    // Then the failure puts back the broker the backend still holds.
    await waitFor(() => {
      expect(row.getByDisplayValue('ECO')).toBeInTheDocument()
    })
  })

  it('sells the whole position at the current quote', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null, { status: 201 })
      }),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const tickerCell = await screen.findByRole('cell', { name: 'AAPL' })
    const row = within(tickerCell.closest('tr') as HTMLElement)
    const sellButton = row.getByRole('button', { name: /vender/i })

    await waitFor(() => expect(sellButton).toBeEnabled())
    fireEvent.click(sellButton)

    await waitFor(() => {
      expect(posted).toMatchObject({
        ticker: 'AAPL',
        broker: 'ECO',
        category: 'Acciones',
        operation_type: 'SELL',
        quantity: '10',
        unit_price: '190.00',
        currency: 'USD',
      })
    })
  })

  it('disables the sell action while the quote is unknown', async () => {
    server.use(
      http.get('*/api/v1/analysis/:ticker', () => HttpResponse.json(unknownAnalysis)),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const tickerCell = await screen.findByRole('cell', { name: 'AAPL' })
    const row = within(tickerCell.closest('tr') as HTMLElement)

    await waitFor(() => {
      expect(row.getByRole('button', { name: /vender/i })).toBeDisabled()
    })
  })

  it('keeps a position value that is missing from the catalog selected', async () => {
    // The catalog no longer offers "Acciones", but the stored position still
    // holds it. The row must keep showing it instead of rendering a blank
    // selector, which is what a `value` with no matching `option` produces.
    window.localStorage.setItem(
      CATEGORIES_STORAGE_KEY,
      JSON.stringify(['Cedear', 'ETF']),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const tickerCell = await screen.findByRole('cell', { name: 'AAPL' })
    const row = within(tickerCell.closest('tr') as HTMLElement)
    expect(row.getByDisplayValue('Acciones')).toBeInTheDocument()
  })

  it('filters holdings by ticker, asset type and broker', async () => {
    renderWithRouter({ initialEntries: ['/portfolio'] })
    await screen.findByRole('heading', { name: /posiciones en cartera/i })

    expect(await screen.findByRole('cell', { name: 'AAPL' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtro de tipo'), {
      target: { value: 'Cripto' },
    })
    expect(screen.queryByRole('cell', { name: 'AAPL' })).not.toBeInTheDocument()
    expect(screen.getByText('Sin resultados para los filtros aplicados.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }))
    // The ticker cell shows the alias display name once aliases load, so assert
    // on the row's quantity cell (unique to the single fixture position).
    expect(await screen.findByRole('cell', { name: '10' }, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows only the last three transactions in the recent transactions card', async () => {
    const recent = [
      { id: 5, ticker: 'NVDA', broker: 'ECO', category: 'Acciones', operation_type: 'BUY', quantity: '4', unit_price: '875.20', currency: 'USD', occurred_at: '2024-03-04T14:32:10' },
      { id: 4, ticker: 'BTC', broker: 'BINANCE', category: 'Cripto', operation_type: 'BUY', quantity: '0.05', unit_price: '64200.00', currency: 'USD', occurred_at: '2024-03-03T18:04:19' },
      { id: 3, ticker: 'MSFT', broker: 'ECO', category: 'Acciones', operation_type: 'SELL', quantity: '10', unit_price: '415.50', currency: 'USD', occurred_at: '2024-02-24T10:15:02' },
      { id: 2, ticker: 'KO', broker: 'ECO', category: 'Acciones', operation_type: 'BUY', quantity: '3', unit_price: '60.00', currency: 'USD', occurred_at: '2024-02-20T11:00:00' },
      { id: 1, ticker: 'PAMP.BA', broker: 'PPI', category: 'Cedear', operation_type: 'SELL', quantity: '2', unit_price: '4802.50', currency: 'ARS', occurred_at: '2024-02-19T09:30:00' },
    ]
    server.use(
      http.get('*/api/v1/transactions', () => HttpResponse.json(recent)),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })

    const card = await screen.findByRole('region', { name: /últimas transacciones/i })
    await within(card).findByText(/NVDA/)
    expect(within(card).getAllByText(/u\.$/)).toHaveLength(3)
    expect(within(card).queryByText(/KO/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/PAMP\.BA/)).not.toBeInTheDocument()
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
      expect(screen.getByLabelText('Precio')).toHaveValue('190.00')
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

  it('searches an asset, picks it, and submits that symbol', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null, { status: 201 })
      }),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })
    await screen.findByRole('heading', { name: /posiciones en cartera/i })

    const combobox = screen.getByRole('combobox', { name: /activo/i })
    fireEvent.change(combobox, { target: { value: 'apple' } })

    // The suggestion list comes from the search endpoint, not a hardcoded list.
    // The control debounces typing, so the wait is generous: a loaded test run
    // can push the response past the one-second default.
    fireEvent.click(await screen.findByRole('option', { name: /AAPL/ }, { timeout: 5000 }))
    expect(combobox).toHaveValue('AAPL')

    await waitFor(() => {
      expect(screen.getByLabelText('Precio')).toHaveValue('190.00')
    })

    fireEvent.click(screen.getByRole('button', { name: /registrar transacción/i }))

    expect(await screen.findByText('¡Transacción Registrada!')).toBeInTheDocument()
    expect(posted).toMatchObject({ ticker: 'AAPL', unit_price: '190.00' })
  })

  it('records an Argentine listing in pesos instead of dollars', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.post('*/api/v1/transactions', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null, { status: 201 })
      }),
    )

    renderWithRouter({ initialEntries: ['/portfolio'] })
    await screen.findByRole('heading', { name: /posiciones en cartera/i })

    fireEvent.change(screen.getByRole('combobox', { name: /activo/i }), {
      target: { value: 'PAMP.BA' },
    })

    // The quote supplies the price and the currency the ticket will record.
    await waitFor(() => {
      expect(screen.getByLabelText('Precio')).toHaveValue('4802.50')
    })
    expect(screen.getAllByText('ARS')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /registrar transacción/i }))

    expect(await screen.findByText('¡Transacción Registrada!')).toBeInTheDocument()
    expect(posted).toMatchObject({
      ticker: 'PAMP.BA',
      unit_price: '4802.50',
      currency: 'ARS',
    })
  })
})
