/**
 * Transaction history table with per-row deletion.
 */

import type { TransactionSummary } from '../../api/client'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'

export interface TransactionHistoryTableProps {
  transactions: TransactionSummary[]
  onDelete: (transactionId: number) => void
}

/** Render one row per transaction, each with its own delete action. */
export function TransactionHistoryTable({
  transactions,
  onDelete,
}: TransactionHistoryTableProps) {
  const columns: Column<TransactionSummary>[] = [
    { key: 'id', header: 'ID', render: (transaction) => String(transaction.id) },
    { key: 'ticker', header: 'Ticker', render: (transaction) => transaction.ticker },
    { key: 'broker', header: 'Broker', render: (transaction) => transaction.broker },
    { key: 'category', header: 'Category', render: (transaction) => transaction.category },
    {
      key: 'operation_type',
      header: 'Operation',
      render: (transaction) => transaction.operation_type,
    },
    { key: 'quantity', header: 'Quantity', render: (transaction) => transaction.quantity },
    {
      key: 'unit_price',
      header: 'Unit price',
      render: (transaction) => (
        <CurrencyAmount amount={transaction.unit_price} currency={transaction.currency} />
      ),
    },
    {
      key: 'occurred_at',
      header: 'Occurred at',
      render: (transaction) => transaction.occurred_at,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (transaction) => (
        <button type="button" onClick={() => onDelete(transaction.id)}>
          Delete
        </button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={transactions}
      getRowKey={(transaction) => transaction.id}
      emptyMessage="No transactions found."
    />
  )
}
