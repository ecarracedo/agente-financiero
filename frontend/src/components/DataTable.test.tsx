import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import type { Column } from './DataTable'
import { DataTable } from './DataTable'

interface Row {
  ticker: string
  amount: string
}

const rows: Row[] = [
  { ticker: 'AAPL', amount: '1900.00' },
  { ticker: 'MSFT', amount: '1500.00' },
]

function columnsWithAlignment(): Column<Row>[] {
  return [
    { key: 'ticker', header: 'Ticker', render: (row) => row.ticker },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => row.amount },
  ]
}

/**
 * Contract for the shared table primitive.
 *
 * The spec requires data views not to render as unstyled raw HTML, so the table
 * is built on the vendored Tremor primitives. A caption is required because a
 * table without one is announced as an unnamed table by assistive technology.
 *
 * Alignment is asserted through the rendered cell's `data-align`, not a class
 * name: the requirement is that a numeric column is aligned, and a styling class
 * is an implementation detail that a refactor would silently change.
 */
describe('DataTable', () => {
  it('renders a real table with a column header per column', () => {
    render(
      <DataTable
        caption="Holdings"
        columns={columnsWithAlignment()}
        rows={rows}
        getRowKey={(row) => row.ticker}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Ticker' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument()
  })

  it('names the table through its caption', () => {
    render(
      <DataTable
        caption="Holdings"
        columns={columnsWithAlignment()}
        rows={rows}
        getRowKey={(row) => row.ticker}
      />,
    )

    // The accessible name comes from the caption, which is what lets a screen
    // reader announce which table it is looking at.
    expect(screen.getByRole('table', { name: 'Holdings' })).toBeInTheDocument()
  })

  it('marks a numeric column as right aligned and the others as left aligned', () => {
    render(
      <DataTable
        caption="Holdings"
        columns={columnsWithAlignment()}
        rows={rows}
        getRowKey={(row) => row.ticker}
      />,
    )

    const amountHeader = screen.getByRole('columnheader', { name: 'Amount' })
    const tickerHeader = screen.getByRole('columnheader', { name: 'Ticker' })

    expect(amountHeader).toHaveAttribute('data-align', 'right')
    expect(tickerHeader).toHaveAttribute('data-align', 'left')

    // The alignment has to reach the cells too, not only the header.
    const row = screen.getAllByRole('row')[1]
    const cells = within(row).getAllByRole('cell')
    expect(cells[1]).toHaveAttribute('data-align', 'right')
  })

  it('renders one row per record', () => {
    render(
      <DataTable
        caption="Holdings"
        columns={columnsWithAlignment()}
        rows={rows}
        getRowKey={(row) => row.ticker}
      />,
    )

    // One header row plus one per record.
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1)
  })

  it('shows an empty state naming the view when there are no records', () => {
    render(
      <DataTable
        caption="Holdings"
        columns={columnsWithAlignment()}
        rows={[]}
        getRowKey={(row) => row.ticker}
        emptyMessage="No holdings yet."
      />,
    )

    expect(screen.getByText('No holdings yet.')).toBeInTheDocument()
    // No table is rendered when there is nothing to show.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('falls back to a generic empty message when the view gives none', () => {
    render(
      <DataTable caption="Holdings" columns={columnsWithAlignment()} rows={[]} getRowKey={() => 'r'} />,
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
  })
})
