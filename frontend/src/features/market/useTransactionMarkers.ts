/**
 * Data-fetching hook for the transaction markers of the selected position.
 */

import { useEffect, useState } from 'react'

import type { TransactionSummary } from '../../api/client'
import { marketApi } from './marketApi'

interface ResolvedMarkers {
  ticker: string
  broker: string
  transactions: TransactionSummary[]
}

/**
 * Load the transaction history used as chart markers for a position.
 *
 * @param ticker Position ticker; `null` performs no request.
 * @param broker Position broker; `null` performs no request.
 */
export function useTransactionMarkers(
  ticker: string | null,
  broker: string | null,
): TransactionSummary[] {
  const [resolved, setResolved] = useState<ResolvedMarkers | null>(null)

  useEffect(() => {
    if (ticker === null || broker === null) return

    let active = true

    marketApi
      .listTransactions(ticker, broker)
      .then((transactions) => {
        if (active) setResolved({ ticker, broker, transactions })
      })
      .catch(() => {
        if (active) setResolved({ ticker, broker, transactions: [] })
      })

    return () => {
      active = false
    }
  }, [ticker, broker])

  if (ticker === null || broker === null) return []
  if (resolved !== null && resolved.ticker === ticker && resolved.broker === broker) {
    return resolved.transactions
  }
  return []
}
