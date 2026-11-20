import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../../tests/setup'
import { AlertsWorkspace } from './AlertsWorkspace'

describe('AlertsWorkspace', () => {
  it('lists every configured alert with its scope, type and target', async () => {
    render(<AlertsWorkspace />)

    const list = (await screen.findByText('AAPL · ECO · Acciones'))
      .closest('ul') as HTMLElement
    const rows = within(list).getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('AAPL · ECO · Acciones')
    expect(rows[0]).toHaveTextContent('Compra')
    expect(rows[0]).toHaveTextContent('190,00 USD')
    expect(rows[1]).toHaveTextContent('NVDA · wishlist')
    expect(rows[1]).toHaveTextContent('Venta')
  })

  it('prefills the selected target with its saved alert', async () => {
    render(<AlertsWorkspace />)

    await screen.findByText('AAPL · ECO · Acciones')

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

    const list = (await screen.findByText('AAPL · ECO · Acciones'))
      .closest('ul') as HTMLElement
    fireEvent.click(within(list).getAllByRole('button', { name: /eliminar/i })[0])

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

  it('runs a pass through Check now', async () => {
    const evaluated: string[] = []
    server.use(
      http.post('*/api/v1/alerts/evaluate', () => {
        evaluated.push('evaluate')
        return HttpResponse.json([])
      }),
    )

    render(<AlertsWorkspace />)

    await screen.findByText(/Precio objetivo de compra alcanzado/)
    fireEvent.click(screen.getByRole('button', { name: /evaluar ahora/i }))

    await waitFor(() => expect(evaluated).toEqual(['evaluate']))
  })

  it('allows configuring an alert for an asset outside portfolio and wishlist', async () => {
    render(<AlertsWorkspace />)

    await screen.findByText('AAPL · ECO · Acciones')

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

    await screen.findByText('AAPL · ECO · Acciones')

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

    await screen.findByText('AAPL · ECO · Acciones')
    const scopeGroup = screen.getByRole('group', { name: 'Ámbito' })
    fireEvent.click(within(scopeGroup).getByRole('button', { name: 'Otro activo' }))
    fireEvent.change(screen.getByLabelText('Buscar activo'), { target: { value: 'TSLA' } })

    await waitFor(() => expect(screen.getByLabelText('Precio objetivo')).toHaveValue('190.00'))
    await waitFor(() => expect(screen.getByRole('button', { name: '+25%' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '+25%' }))
    expect(screen.getByLabelText('Precio objetivo')).toHaveValue('237.50')
  })
})
