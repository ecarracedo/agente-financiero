/**
 * Transactions workspace: buy/sell form and ticker-scoped history.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import type { TransactionRequest } from '../../api/client'
import { api } from '../../api/client'
import { ApiError } from '../../api/http'
import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { TextField } from '../../components/FormControls'
import { TransactionForm } from './TransactionForm'
import { TransactionHistoryTable } from './TransactionHistoryTable'
import type { HistoryCriteria } from './useTransactionHistory'
import { useTransactionHistory } from './useTransactionHistory'

export interface TransactionsWorkspaceProps {
  /** Notify the shell that holdings may have changed after a mutation. */
  onPortfolioChanged?: () => void
}

/** Record purchases/sales and inspect or delete their history. */
export function TransactionsWorkspace({ onPortfolioChanged }: TransactionsWorkspaceProps) {
  const [criteria, setCriteria] = useState<HistoryCriteria | null>(null)
  const [historyToken, setHistoryToken] = useState(0)
  const [filterTicker, setFilterTicker] = useState('')
  const [filterBroker, setFilterBroker] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { status, transactions, error } = useTransactionHistory(criteria, historyToken)

  async function handleSubmit(payload: TransactionRequest): Promise<boolean> {
    setSubmitError(null)
    setSuccessMessage(null)
    try {
      await api.createTransaction(payload)
      setSuccessMessage('Operation recorded.')
      onPortfolioChanged?.()
      setFilterTicker(payload.ticker)
      setFilterBroker(payload.broker)
      setCriteria({ ticker: payload.ticker, broker: payload.broker })
      setHistoryToken((token) => token + 1)
      return true
    } catch (caught) {
      if (caught instanceof ApiError) {
        setSubmitError('Operation rejected: the backend refused the request.')
        return false
      }
      setSubmitError(describeApiError(caught))
      return false
    }
  }

  async function handleDelete(transactionId: number) {
    if (typeof window !== 'undefined' && typeof (window as any).confirm === 'function') {
      if ((window as any).confirm('Delete this transaction?') === false) {
        return
      }
    }
    try {
      await api.deleteTransaction(transactionId)
      onPortfolioChanged?.()
      setHistoryToken((token) => token + 1)
    } catch (caught) {
      setSubmitError(describeApiError(caught))
    }
  }

  function handleViewHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    const ticker = filterTicker.trim()
    const broker = filterBroker.trim()
    if (ticker.length === 0 || broker.length === 0) {
      setSubmitError('Ticker and broker are required to load history.')
      return
    }
    setCriteria({ ticker, broker })
    setHistoryToken((token) => token + 1)
  }

  return (
    <section aria-labelledby="transactions-heading">
      <h2 id="transactions-heading">Transactions</h2>

      <TransactionForm onSubmit={handleSubmit} />
      {submitError ? <ErrorState message={submitError} /> : null}
      {successMessage ? <p role="status">{successMessage}</p> : null}

      <section aria-labelledby="history-heading">
        <h3 id="history-heading">Transaction history</h3>
        <form onSubmit={handleViewHistory} noValidate>
          <TextField
            id="history-ticker"
            label="History ticker"
            value={filterTicker}
            onChange={setFilterTicker}
          />
          <TextField
            id="history-broker"
            label="History broker"
            value={filterBroker}
            onChange={setFilterBroker}
          />
          <button type="submit">View history</button>
        </form>
        {status === 'loading' ? <LoadingState label="Loading history…" /> : null}
        {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
        {status === 'ready' ? (
          <TransactionHistoryTable transactions={transactions} onDelete={handleDelete} />
        ) : null}
      </section>
    </section>
  )
}
