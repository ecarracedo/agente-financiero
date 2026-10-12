/**
 * Small, reusable table primitive for tabular data views.
 */

import type { ReactNode } from 'react'

export interface Column<T> {
  /** Stable identity for the column. */
  key: string
  /** Header text rendered in the table head. */
  header: string
  /** Cell renderer for one row. */
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string | number
  emptyMessage?: string
}

/** Render rows as a semantic table, or an empty message when there is no data. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No data',
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p>{emptyMessage}</p>
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={getRowKey(row, index)}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
