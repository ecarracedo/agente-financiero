import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/http'
import { SplitWorkspace } from './SplitWorkspace'
import { splitApi } from './splitApi'

vi.mock('./splitApi', () => ({
  splitApi: {
    calculate: vi.fn(),
  },
}))

/**
 * Fill the split form with the canonical string inputs and a ratio.
 */
function fillSplitForm(ratio: string) {
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('Average price'), { target: { value: '50.00' } })
  fireEvent.change(screen.getByLabelText('Ratio'), { target: { value: ratio } })
}

describe('SplitWorkspace', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('projects a forward split and displays the canonical results', async () => {
    vi.mocked(splitApi.calculate).mockResolvedValue({
      quantity: '200',
      average_price: '25.00',
      ratio: '2:1',
    })

    render(<SplitWorkspace />)

    fillSplitForm('2')
    fireEvent.click(screen.getByRole('button', { name: /calculate split/i }))

    await waitFor(() =>
      expect(splitApi.calculate).toHaveBeenCalledWith({
        quantity: '100',
        average_price: '50.00',
        new_shares: 2,
        old_shares: 1,
      }),
    )
    expect(await screen.findByText('200')).toBeInTheDocument()
    expect(screen.getByText('25.00')).toBeInTheDocument()
    expect(screen.getByText('2:1')).toBeInTheDocument()
  })

  it('projects a reverse split and displays the canonical results', async () => {
    vi.mocked(splitApi.calculate).mockResolvedValue({
      quantity: '50',
      average_price: '100.00',
      ratio: '1:2',
    })

    render(<SplitWorkspace />)

    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'reverse' } })
    fillSplitForm('2')
    fireEvent.click(screen.getByRole('button', { name: /calculate split/i }))

    await waitFor(() =>
      expect(splitApi.calculate).toHaveBeenCalledWith({
        quantity: '100',
        average_price: '50.00',
        new_shares: 1,
        old_shares: 2,
      }),
    )
    expect(await screen.findByText('50')).toBeInTheDocument()
    expect(screen.getByText('100.00')).toBeInTheDocument()
    expect(screen.getByText('1:2')).toBeInTheDocument()
  })

  it('surfaces an invalid ratio (422) as an error and never as a result', async () => {
    vi.mocked(splitApi.calculate).mockRejectedValue(
      new ApiError(422, [{ loc: ['body', 'new_shares'], msg: 'Input should be greater than 0' }]),
    )

    render(<SplitWorkspace />)

    fillSplitForm('0')
    fireEvent.click(screen.getByRole('button', { name: /calculate split/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i)
    expect(screen.queryByText('200')).not.toBeInTheDocument()
  })

  it('maps a non-numeric forward ratio to 0 shares so the backend rejects it', async () => {
    vi.mocked(splitApi.calculate).mockRejectedValue(
      new ApiError(422, [{ loc: ['body', 'new_shares'], msg: 'Input should be greater than 0' }]),
    )

    render(<SplitWorkspace />)

    fillSplitForm('abc')
    fireEvent.click(screen.getByRole('button', { name: /calculate split/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i)
    expect(splitApi.calculate).toHaveBeenCalledTimes(1)
    expect(splitApi.calculate).toHaveBeenCalledWith({
      quantity: '100',
      average_price: '50.00',
      new_shares: 0,
      old_shares: 1,
    })
    expect(screen.queryByRole('heading', { name: 'Result' })).not.toBeInTheDocument()
  })

  it('maps a non-numeric reverse ratio to 0 old shares', async () => {
    vi.mocked(splitApi.calculate).mockRejectedValue(new ApiError(422, []))

    render(<SplitWorkspace />)

    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'reverse' } })
    fillSplitForm('   ')
    fireEvent.click(screen.getByRole('button', { name: /calculate split/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(splitApi.calculate).toHaveBeenCalledWith({
      quantity: '100',
      average_price: '50.00',
      new_shares: 1,
      old_shares: 0,
    })
  })

  it('sends exactly one request with the exact payload keys and string amounts', async () => {
    vi.mocked(splitApi.calculate).mockResolvedValue({
      quantity: '300',
      average_price: '16.67',
      ratio: '3:1',
    })

    render(<SplitWorkspace />)

    fillSplitForm(' 3 ')
    fireEvent.click(screen.getByRole('button', { name: /calculate split/i }))

    expect(await screen.findByRole('heading', { name: 'Result' })).toBeInTheDocument()
    expect(splitApi.calculate).toHaveBeenCalledTimes(1)
    const [payload] = vi.mocked(splitApi.calculate).mock.calls[0]
    expect(payload).toStrictEqual({
      quantity: '100',
      average_price: '50.00',
      new_shares: 3,
      old_shares: 1,
    })
    expect(typeof payload.quantity).toBe('string')
    expect(typeof payload.average_price).toBe('string')
  })
})
