/**
 * Currency-grouped valuations and gain/loss table.
 */

import type { CurrencyValuation } from '../../api/client'
import { CurrencyAmount, NOT_AVAILABLE } from '../../components/CurrencyAmount'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'

const columns: Column<CurrencyValuation>[] = [
  { key: 'currency', header: 'Currency', render: (valuation) => valuation.currency },
  {
    key: 'invested_value',
    header: 'Invested',
    render: (valuation) => (
      <CurrencyAmount amount={valuation.invested_value} currency={valuation.currency} />
    ),
  },
  {
    key: 'market_value',
    header: 'Market value',
    render: (valuation) => (
      <CurrencyAmount amount={valuation.market_value} currency={valuation.currency} />
    ),
  },
  {
    key: 'gain_loss',
    header: 'Gain/Loss',
    render: (valuation) => (
      <CurrencyAmount amount={valuation.gain_loss} currency={valuation.currency} />
    ),
  },
  {
    key: 'gain_loss_percent',
    header: 'Gain/Loss %',
    render: (valuation) =>
      valuation.gain_loss_percent === null
        ? NOT_AVAILABLE
        : `${valuation.gain_loss_percent}%`,
  },
  {
    key: 'unpriced_tickers',
    header: 'Unpriced',
    render: (valuation) =>
      valuation.unpriced_tickers.length > 0 ? valuation.unpriced_tickers.join(', ') : '—',
  },
]

export interface ValuationsTableProps {
  valuations: CurrencyValuation[]
}

/** Render one valuation row per currency; totals are never merged across rows. */
export function ValuationsTable({ valuations }: ValuationsTableProps) {
  return (
    <DataTable
      columns={columns}
      rows={valuations}
      getRowKey={(valuation) => valuation.currency}
      emptyMessage="No valuations yet."
    />
  )
}
