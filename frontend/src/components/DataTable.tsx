/**
 * Shared table primitive for tabular data views.
 *
 * Built on the vendored Tremor table primitives so a data view is never raw
 * unstyled HTML. Two things are added on top of them:
 *
 * - A `caption` is required. A table without one is announced as an unnamed
 *   table by assistive technology, and "which table is this" is exactly what a
 *   data view needs to answer.
 * - A column can declare `align`. The alignment is written to `data-align` on
 *   both the header and its cells, so it is present in the markup rather than
 *   only in a styling class, and a refactor cannot drop it silently.
 *
 * `render` stays the caller's contract: a column owns what its cells contain, and
 * the primitive only decides how they are laid out.
 */

import type { ReactNode } from 'react'

import { EmptyState } from './AsyncStates'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from './tremor/Table'

/** Horizontal alignment of a column and its cells. */
export type ColumnAlign = 'left' | 'right' | 'center'

export interface Column<T> {
  /** Stable identity for the column. */
  key: string
  /** Header text rendered in the table head. */
  header: string
  /** Cell renderer for one row. */
  render: (row: T) => ReactNode
  /** Horizontal alignment; defaults to `left`. */
  align?: ColumnAlign
}

export interface DataTableProps<T> {
  /** Accessible name for the table; announced by assistive technology. */
  caption: string
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string | number
  /** View-specific wording shown when there are no records. */
  emptyMessage?: string
}

/**
 * Class applied to a cell or header for its alignment.
 *
 * Tremor's own classes already set `text-left` on the header, so a right-aligned
 * column has to override it rather than add to it.
 */
function alignClass(align: ColumnAlign): string {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

/** Render rows as a semantic table, or an empty state when there is no data. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No data',
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <TableRoot>
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeaderCell
                key={column.key}
                data-align={column.align ?? 'left'}
                className={`${alignClass(column.align ?? 'left')} !text-center`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#869397]">{column.header}</span>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={getRowKey(row, index)}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  data-align={column.align ?? 'left'}
                  className={alignClass(column.align ?? 'left')}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableRoot>
  )
}
