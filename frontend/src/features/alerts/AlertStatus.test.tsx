import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/http'
import { AlertStatus } from './AlertStatus'

describe('AlertStatus', () => {
  it('shows nothing while idle', () => {
    const { container } = render(<AlertStatus state={{ kind: 'idle' }} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the backend intent-specific message on a crossing', () => {
    render(
      <AlertStatus
        state={{
          kind: 'crossing',
          currentPrice: '305.00',
          event: { intent: 'SELL', message: 'Precio objetivo de venta alcanzado.' },
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Precio objetivo de venta alcanzado.')
  })

  it('reports no crossing when the backend returns no event', () => {
    render(<AlertStatus state={{ kind: 'no-crossing', currentPrice: '150.00' }} />)

    expect(screen.getByText(/no crossing/i)).toBeInTheDocument()
  })

  it('shows an unavailable state, never zero, when the market price is missing', () => {
    render(<AlertStatus state={{ kind: 'unavailable' }} />)

    expect(screen.getByRole('status')).toHaveTextContent(/not available/i)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('surfaces check failures as an error', () => {
    render(<AlertStatus state={{ kind: 'error', error: new ApiError(500, null) }} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
