import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../../tests/setup'
import { AlertsWorkspace } from './AlertsWorkspace'

describe('AlertsWorkspace', () => {
  it('shows configured alerts in the portfolio holdings table style', async () => {
    render(<AlertsWorkspace />)

    const table = await screen.findByRole('table', { name: 'Alertas configuradas' })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    const rows = within(table).getAllByRole('row').slice(1)

    expect(headers).toEqual(['Ticker', 'Origen', 'Tipo', 'Objetivo', 'Acción'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('AAPL')
    expect(rows[0]).toHaveTextContent('ECO · Acciones')
    expect(rows[0]).toHaveTextContent('Compra')
    expect(rows[0]).toHaveTextContent('190,00 USD')
    expect(rows[1]).toHaveTextContent('NVDA')
    expect(rows[1]).toHaveTextContent('Wishlist')
    expect(rows[1]).toHaveTextContent('$ 120,00 USD')
    expect(rows[1]).toHaveTextContent('Venta')
  })

  it('does not offer the wishlist scope when creating an alert', async () => {
    render(<AlertsWorkspace />)

    const scopeGroup = await screen.findByRole('group', { name: 'Ámbito' })
    expect(within(scopeGroup).queryByRole('button', { name: 'Wishlist' })).not.toBeInTheDocument()
    expect(within(scopeGroup).getByRole('button', { name: 'Cartera' })).toBeInTheDocument()
    expect(within(scopeGroup).getByRole('button', { name: 'Otro activo' })).toBeInTheDocument()
  })

  it('prefills the selected target with its saved alert', async () => {
    render(<AlertsWorkspace />)

    await screen.findByRole('table', { name: 'Alertas configuradas' })

    fireEvent.change(screen.getByLabelText('Posición de cartera'), {
      target: { value: 'portfolio:ECO:AAPL' },
    })

    expect(await screen.findByLabelText('Tipo')).toHaveValue('BUY')
    expect(screen.getByLabelText('Precio objetivo')).toHaveValue('190.00')
  })

  it('removes a portfolio alert using the position identity', async () => {
    const requested: string[] = []
    server.use(
      http.delete('*/api/v1/portfolio/:ticker/alert', ({ request }) => {
        requested.push(request.url)
        return HttpResponse.json({ deleted: true })
      }),
    )

    render(<AlertsWorkspace />)

    const table = await screen.findByRole('table', { name: 'Alertas configuradas' })
    fireEvent.click(within(table).getAllByRole('button', { name: /eliminar/i })[0])

    await waitFor(() => expect(requested).toHaveLength(1))
    expect(requested[0]).toContain('broker=ECO')
    expect(requested[0]).toContain('category=Acciones')
  })

  it('lists triggered events with their message and observed price', async () => {
    render(<AlertsWorkspace />)

    expect(await screen.findByText(/AAPL · Precio objetivo de compra alcanzado/)).toBeInTheDocument()
    expect(screen.getByText(/Precio objetivo de venta alcanzado/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /reconocer/i })).toHaveLength(2)
  })

  it('acknowledges a triggered event through the events route', async () => {
    const acknowledged: number[] = []
    server.use(
      http.post('*/api/v1/alerts/events/:event_id/acknowledge', ({ params }) => {
        acknowledged.push(Number(params.event_id))
        return HttpResponse.json({ acknowledged: true })
      }),
    )

    render(<AlertsWorkspace />)

    const [acknowledge] = await screen.findAllByRole('button', { name: /reconocer/i })
    fireEvent.click(acknowledge)

    await waitFor(() => expect(acknowledged).toEqual([1]))
  })

  it('does not expose an Evaluate now action in the alert center', async () => {
    render(<AlertsWorkspace />)

    await screen.findByRole('table', { name: 'Alertas configuradas' })

    expect(
      screen.queryByRole('button', { name: /evaluar ahora|check now/i }),
    ).not.toBeInTheDocument()
  })

  it('allows configuring an alert for an asset outside portfolio and wishlist', async () => {
    render(<AlertsWorkspace />)

    await screen.findByRole('table', { name: 'Alertas configuradas' })

    const scopeGroup = screen.getByRole('group', { name: 'Ámbito' })
    fireEvent.click(within(scopeGroup).getByRole('button', { name: 'Otro activo' }))

    const search = screen.getByLabelText('Buscar activo')
    fireEvent.change(search, { target: { value: 'NV' } })

    const suggestion = await screen.findByRole('option', { name: /NVDA/ })
    fireEvent.click(suggestion)

    expect(await screen.findByRole('heading', { name: 'Alerta de precio objetivo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument()
    expect(screen.getByLabelText('Precio objetivo')).toHaveValue('120.00')
  })

  it('shows the current quote and prefills the target price for an unsaved asset', async () => {
    render(<AlertsWorkspace />)

    await screen.findByRole('table', { name: 'Alertas configuradas' })

    const scopeGroup = screen.getByRole('group', { name: 'Ámbito' })
    fireEvent.click(within(scopeGroup).getByRole('button', { name: 'Otro activo' }))

    fireEvent.change(screen.getByLabelText('Buscar activo'), {
      target: { value: 'TSLA' },
    })

    expect(await screen.findByRole('heading', { name: 'Alerta de precio objetivo' })).toBeInTheDocument()
    expect(await screen.findByText(/Cotización actual:/)).toHaveTextContent('190,00')
    expect(await screen.findByLabelText('Precio objetivo')).toHaveValue('190.00')
  })

  it('names the creation card without the quick or configurator wording', async () => {
    render(<AlertsWorkspace />)

    expect(await screen.findByRole('heading', { name: 'Creación de alerta' })).toBeInTheDocument()
    expect(screen.queryByText(/rápida/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/configurador/i)).not.toBeInTheDocument()
  })

  it('applies percentage increases to the live quote in the creation card', async () => {
    render(<AlertsWorkspace />)

    await screen.findByRole('table', { name: 'Alertas configuradas' })
    const scopeGroup = screen.getByRole('group', { name: 'Ámbito' })
    fireEvent.click(within(scopeGroup).getByRole('button', { name: 'Otro activo' }))
    fireEvent.change(screen.getByLabelText('Buscar activo'), { target: { value: 'TSLA' } })

    await waitFor(() => expect(screen.getByLabelText('Precio objetivo')).toHaveValue('190.00'))
    await waitFor(() => expect(screen.getByRole('button', { name: '+25%' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '+25%' }))
    expect(screen.getByLabelText('Precio objetivo')).toHaveValue('237.50')
  })
})
