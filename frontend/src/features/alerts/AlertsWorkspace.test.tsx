import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '../../../tests/setup'
import { AlertsWorkspace } from './AlertsWorkspace'

describe('AlertsWorkspace', () => {
  it('lists every configured alert with its scope, type and target', async () => {
    render(<AlertsWorkspace />)

    const list = await screen.findByRole('list')
    const rows = within(list).getAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('AAPL · ECO · Acciones')
    expect(rows[0]).toHaveTextContent('Buy')
    expect(rows[0]).toHaveTextContent('190,00 USD')
    expect(rows[1]).toHaveTextContent('NVDA · wishlist')
    expect(rows[1]).toHaveTextContent('Sell')
  })

  it('prefills the selected target with its saved alert', async () => {
    render(<AlertsWorkspace />)

    await screen.findByRole('list')

    fireEvent.change(screen.getByLabelText('Position'), {
      target: { value: 'portfolio:ECO:AAPL' },
    })

    expect(await screen.findByLabelText('Type')).toHaveValue('BUY')
    expect(screen.getByLabelText('Target price')).toHaveValue('190.00')
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

    const list = await screen.findByRole('list')
    fireEvent.click(within(list).getAllByRole('button', { name: /remove/i })[0])

    await waitFor(() => expect(requested).toHaveLength(1))
    expect(requested[0]).toContain('broker=ECO')
    expect(requested[0]).toContain('category=Acciones')
  })
})
