/**
 * Data-fetching hook for a ticker/broker-scoped transaction history.
 */

import { useEffect, useState } from 'react'

import type { TransactionSummary } from '../../api/client'
import { api } from '../../api/client'

/** Criteria identifying the position whose history is displayed. */
export interface HistoryCriteria {
  ticker: string
  broker: string
}

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface HistoryResult {
  status: HistoryStatus
  transactions: TransactionSummary[]
  error: unknown
}

interface ResolvedHistory {
  criteria: HistoryCriteria
  transactions: TransactionSummary[]
}

interface FailedHistory {
  criteria: HistoryCriteria
  error: unknown
}

/**
 * Load the transaction history for a position.
 *
 * Status is derived from the resolved/failed request identity so that a newly
 * selected position reports `loading` until its request settles, without
 * synchronously writing state from the effect body.
 *
 * @param criteria Position selector; when `null` no request is made.
 * @param refreshToken Counter that forces a refetch after a mutation.
 */
export function useTransactionHistory(
  criteria: HistoryCriteria | null,
  refreshToken: number,
): HistoryResult {
  const [resolved, setResolved] = useState<ResolvedHistory | null>(null)
  const [failure, setFailure] = useState<FailedHistory | null>(null)

  useEffect(() => {
    if (criteria === null) return

    let active = true

    api
      .listTransactions(criteria.ticker, criteria.broker)
      .then((transactions) => {
        if (!active) return
        setResolved({ criteria, transactions })
        setFailure(null)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setFailure({ criteria, error: caught })
      })

    return () => {
      active = false
    }
  }, [criteria, refreshToken])

  if (criteria === null) {
    return { status: 'idle', transactions: [], error: null }
  }
  if (failure !== null && failure.criteria === criteria) {
    return { status: 'error', transactions: [], error: failure.error }
  }
  if (resolved !== null && resolved.criteria === criteria) {
    return { status: 'ready', transactions: resolved.transactions, error: null }
  }
  return { status: 'loading', transactions: [], error: null }
}
