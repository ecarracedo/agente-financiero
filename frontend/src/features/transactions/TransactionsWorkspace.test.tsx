import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TransactionSummary } from '../../api/client'
import { api } from '../../api/client'
import { ApiError } from '../../api/http'
import { TransactionsWorkspace } from './TransactionsWorkspace'

vi.mock('../../api/client', () => ({
  api: {
    listTransactions: vi.fn(),
    createTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}))

const recordedTransaction: TransactionSummary = {
  id: 7,
  ticker: 'AAPL',
  broker: 'IBKR',
  category: 'Stock',
  operation_type: 'BUY',
  quantity: '5',
  unit_price: '120.00',
  currency: 'USD',
  occurred_at: '2024-02-01T10:00:00',
}

/** Fill the operation form with a valid purchase payload. */
function fillOperationForm(operation: 'BUY' | 'SELL' = 'BUY') {
  fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'AAPL' } })
  fireEvent.change(screen.getByLabelText('Broker'), { target: { value: 'IBKR' } })
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Stock' } })
  fireEvent.change(screen.getByLabelText('Operation'), { target: { value: operation } })
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '120.00' } })
  fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } })
  fireEvent.change(screen.getByLabelText('Occurred at'), {
    target: { value: '2024-02-01T10:00' },
  })
}

describe('TransactionsWorkspace', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('submits a purchase as strings and refreshes holdings and history', async () => {
    const onPortfolioChanged = vi.fn()
    vi.mocked(api.createTransaction).mockResolvedValue({
      ticker: 'AAPL',
      broker: 'IBKR',
      category: 'Stock',
      quantity: '5',
      average_price: '120.00',
      currency: 'USD',
    })
    vi.mocked(api.listTransactions).mockResolvedValue([recordedTransaction])

    render(<TransactionsWorkspace onPortfolioChanged={onPortfolioChanged} />)

    expect(api.listTransactions).not.toHaveBeenCalled()

    fillOperationForm('BUY')
    fireEvent.click(screen.getByRole('button', { name: /record operation/i }))

    await waitFor(() => expect(api.createTransaction).toHaveBeenCalledTimes(1))
    expect(api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: 'AAPL',
        broker: 'IBKR',
        operation_type: 'BUY',
        quantity: '5',
        unit_price: '120.00',
        currency: 'USD',
      }),
    )
    expect(onPortfolioChanged).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(api.listTransactions).toHaveBeenCalledWith('AAPL', 'IBKR'),
    )
    expect(await screen.findByText('120.00 USD')).toBeInTheDocument()
  })

  it('shows a rejected operation as an error and never as success', async () => {
    vi.mocked(api.createTransaction).mockRejectedValue(
      new ApiError(422, [{ loc: ['body', 'quantity'], msg: 'Input should be greater than 0' }]),
    )

    render(<TransactionsWorkspace />)

    fillOperationForm('SELL')
    fireEvent.click(screen.getByRole('button', { name: /record operation/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i)
    expect(screen.queryByText(/operation recorded/i)).not.toBeInTheDocument()
  })

  it('deletes a transaction and refreshes the history', async () => {
    const onPortfolioChanged = vi.fn()
    vi.mocked(api.listTransactions).mockResolvedValueOnce([recordedTransaction]).mockResolvedValue([])
    vi.mocked(api.deleteTransaction).mockResolvedValue({ deleted: true })

    render(<TransactionsWorkspace onPortfolioChanged={onPortfolioChanged} />)

    fireEvent.change(screen.getByLabelText('History ticker'), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText('History broker'), { target: { value: 'IBKR' } })
    fireEvent.click(screen.getByRole('button', { name: /view history/i }))

    expect(await screen.findByText('120.00 USD')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith(7))
    await waitFor(() => expect(screen.queryByText('120.00 USD')).not.toBeInTheDocument())
    expect(onPortfolioChanged).toHaveBeenCalledTimes(1)
  })

  it('shows a loading state while the history request is pending', async () => {
    vi.mocked(api.listTransactions).mockReturnValue(new Promise(() => {}))

    render(<TransactionsWorkspace />)

    fireEvent.change(screen.getByLabelText('History ticker'), { target: { value: 'AAPL' } })
    fireEvent.change(screen.getByLabelText('History broker'), { target: { value: 'IBKR' } })
    fireEvent.click(screen.getByRole('button', { name: /view history/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})
