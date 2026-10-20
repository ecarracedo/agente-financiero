/**
 * Holdings table for the portfolio workspace.
 */

import type { PortfolioPosition } from '../../api/client'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'

const columns: Column<PortfolioPosition>[] = [
  { key: 'ticker', header: 'Ticker', render: (position) => position.ticker },
  { key: 'broker', header: 'Broker', render: (position) => position.broker },
  { key: 'category', header: 'Category', render: (position) => position.category },
  {
    key: 'quantity',
    header: 'Quantity',
    align: 'right',
    render: (position) => position.quantity,
  },
  {
    key: 'average_price',
    header: 'Average price',
    align: 'right',
    render: (position) => (
      <CurrencyAmount amount={position.average_price} currency={position.currency} />
    ),
  },
]

export interface HoldingsTableProps {
  positions: PortfolioPosition[]
}

/** Render one row per portfolio position with its currency-labeled price. */
export function HoldingsTable({ positions }: HoldingsTableProps) {
  return (
    <DataTable
      caption="Holdings"
      columns={columns}
      rows={positions}
      getRowKey={(position, index) =>
        `${position.ticker}-${position.broker}-${position.category}-${index}`
      }
      emptyMessage="No holdings yet."
    />
  )
}
