/**
 * Transactions workspace: buy/sell form and ticker-scoped history.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import type { TransactionRequest } from '../../api/client'
import { api } from '../../api/client'
import { ApiError } from '../../api/http'
import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState, SuccessState } from '../../components/AsyncStates'
import { Card } from '../../components/tremor/Card'
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
    if (typeof window !== 'undefined') {
      const maybeConfirm = (window as Window & { confirm?: (message?: string) => boolean }).confirm
      if (typeof maybeConfirm === 'function' && maybeConfirm.call(window, 'Delete this transaction?') === false) {
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
    <section aria-labelledby="transactions-heading" className="space-y-6">
      <h2 id="transactions-heading" className="text-xl font-bold font-headline tracking-tight text-white">
        Transactions
      </h2>

      <Card>
        <h3 className="mb-4 text-base font-semibold font-headline text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">add_circle</span>
          <span>Record Operation</span>
        </h3>
        <TransactionForm onSubmit={handleSubmit} />
      </Card>

      {submitError ? <ErrorState message={submitError} /> : null}
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <Card>
        <section aria-labelledby="history-heading" className="space-y-4">
          <h3 id="history-heading" className="text-base font-semibold font-headline text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">history</span>
            <span>Transaction History</span>
          </h3>
          <form onSubmit={handleViewHistory} noValidate className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <TextField
                id="history-ticker"
                label="History ticker"
                value={filterTicker}
                onChange={setFilterTicker}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <TextField
                id="history-broker"
                label="History broker"
                value={filterBroker}
                onChange={setFilterBroker}
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#262a33] border border-[#3d494c]/60 px-4 py-2 text-sm font-semibold text-white hover:bg-[#31353e] hover:text-[#4cd7f6] transition-all"
            >
              View history
            </button>
          </form>
          {status === 'loading' ? <LoadingState label="Loading history…" /> : null}
          {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
          {status === 'ready' ? (
            <TransactionHistoryTable transactions={transactions} onDelete={handleDelete} />
          ) : null}
        </section>
      </Card>
    </section>
  )
}
