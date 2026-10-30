/**
 * Holdings table for the portfolio workspace.
 */

import type { PortfolioPosition } from '../../api/client'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'

const columns: Column<PortfolioPosition>[] = [
  {
    key: 'ticker',
    header: 'Ticker',
    render: (position) => (
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="w-7 h-7 rounded-md bg-[#262a33] border border-[#3d494c]/50 flex items-center justify-center font-bold text-xs text-[#4cd7f6] font-mono shrink-0"
        >
          {position.ticker.slice(0, 2)}
        </div>
        <span className="font-bold text-white font-mono">{position.ticker}</span>
      </div>
    ),
  },
  {
    key: 'broker',
    header: 'Broker',
    render: (position) => (
      <span className="px-2 py-0.5 rounded bg-[#1c2028] border border-[#3d494c]/30 text-xs text-[#bcc9cd] font-mono">
        {position.broker}
      </span>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    render: (position) => (
      <span className="px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-xs font-medium text-[#4cd7f6]">
        {position.category}
      </span>
    ),
  },
  {
    key: 'quantity',
    header: 'Quantity',
    align: 'right',
    render: (position) => (
      <span className="font-mono text-white">{position.quantity}</span>
    ),
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
