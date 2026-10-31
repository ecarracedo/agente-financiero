import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TransactionSummary } from '../../api/client'
import { api } from '../../api/client'
import type { HistoryCriteria } from './useTransactionHistory'
import { useTransactionHistory } from './useTransactionHistory'

vi.mock('../../api/client', () => ({
  api: { listTransactions: vi.fn() },
}))

const row: TransactionSummary = {
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

const criteriaA: HistoryCriteria = { ticker: 'AAPL', broker: 'IBKR' }
const criteriaB: HistoryCriteria = { ticker: 'MSFT', broker: 'IBKR' }

describe('useTransactionHistory', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('clears an earlier error when a refetch of the same criteria succeeds', async () => {
    vi.mocked(api.listTransactions)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([row] as never)

    const { result, rerender } = renderHook(
      ({ token }) => useTransactionHistory(criteriaA, token),
      { initialProps: { token: 0 } },
    )
    await waitFor(() => expect(result.current.status).toBe('error'))

    rerender({ token: 1 })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.error).toBeNull()
    expect(result.current.transactions).toEqual([row])
  })

  it('surfaces a new error when a refetch fails after a success', async () => {
    vi.mocked(api.listTransactions)
      .mockResolvedValueOnce([row] as never)
      .mockRejectedValueOnce(new Error('second failure'))

    const { result, rerender } = renderHook(
      ({ token }) => useTransactionHistory(criteriaA, token),
      { initialProps: { token: 0 } },
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))

    rerender({ token: 1 })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect((result.current.error as Error).message).toBe('second failure')
  })

  it('drops the previously loaded rows while a refetch failure is shown', async () => {
    vi.mocked(api.listTransactions)
      .mockResolvedValueOnce([row] as never)
      .mockRejectedValueOnce(new Error('second failure'))

    const { result, rerender } = renderHook(
      ({ token }) => useTransactionHistory(criteriaA, token),
      { initialProps: { token: 0 } },
    )
    await waitFor(() => expect(result.current.transactions).toEqual([row]))

    rerender({ token: 1 })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.transactions).toEqual([])
  })

  it('ignores a superseded fetch that settles after the criteria changed', async () => {
    let resolveOld: (value: never) => void = () => {}
    vi.mocked(api.listTransactions)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve as never }))
      .mockResolvedValueOnce([] as never)

    const { result, rerender } = renderHook(
      ({ criteria }) => useTransactionHistory(criteria, 0),
      { initialProps: { criteria: criteriaA } },
    )
    rerender({ criteria: criteriaB })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      resolveOld([row] as never)
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.transactions).toEqual([])
  })
})
