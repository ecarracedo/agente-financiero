// Tremor Table [v1.0.0]
// Vendored into this repository from Tremor Raw. See openspec change
// frontend-tremor-redesign, decision D1.
//
// Only `cx` is required, so this component adds no runtime dependency beyond the
// shared utilities already in this directory.

import React from 'react'

import { cx } from './utils/cx'

/** Scroll container that keeps a wide table usable on a narrow viewport. */
const TableRoot = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => (
    <div ref={forwardedRef}>
      <div
        className={cx('w-full overflow-auto whitespace-nowrap', className)}
        {...props}
      >
        {children}
      </div>
    </div>
  ),
)

TableRoot.displayName = 'TableRoot'

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, forwardedRef) => (
    <table
      ref={forwardedRef}
      tremor-id="tremor-raw"
      className={cx('w-full caption-bottom border-b', 'border-gray-200 dark:border-gray-800', className)}
      {...props}
    />
  ),
)

Table.displayName = 'Table'

const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <thead ref={forwardedRef} className={cx(className)} {...props} />
))

TableHead.displayName = 'TableHead'

/**
 * Header cell for one column.
 *
 * Deviation from Tremor Raw: it defaults `scope` to `col`. Upstream leaves it
 * unset, which relies on the user agent inferring the scope from position. Every
 * table in this application is a data table, so the explicit scope is correct
 * markup and is stated once here instead of at five call sites. A caller passing
 * its own `scope` still wins, because `{...props}` follows the default.
 */
const TableHeaderCell = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = 'col', ...props }, forwardedRef) => (
  <th
    ref={forwardedRef}
    scope={scope}
    className={cx(
      'border-b px-4 py-3.5 text-left text-sm font-semibold',
      'text-gray-900 dark:text-gray-50',
      'border-gray-200 dark:border-gray-800',
      className,
    )}
    {...props}
  />
))

TableHeaderCell.displayName = 'TableHeaderCell'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <tbody
    ref={forwardedRef}
    className={cx('divide-y', 'divide-gray-200 dark:divide-gray-800', className)}
    {...props}
  />
))

TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, forwardedRef) => (
    <tr
      ref={forwardedRef}
      className={cx(
        '[&_td:last-child]:pr-4 [&_th:last-child]:pr-4',
        '[&_td:first-child]:pl-4 [&_th:first-child]:pl-4',
        className,
      )}
      {...props}
    />
  ),
)

TableRow.displayName = 'TableRow'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, forwardedRef) => (
    <td
      ref={forwardedRef}
      className={cx('p-4 text-sm', 'text-gray-600 dark:text-gray-400', className)}
      {...props}
    />
  ),
)

TableCell.displayName = 'TableCell'

const TableFoot = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, forwardedRef) => (
  <tfoot
    ref={forwardedRef}
    className={cx(
      'border-t text-left font-medium',
      'text-gray-900 dark:text-gray-50',
      'border-gray-200 dark:border-gray-800',
      className,
    )}
    {...props}
  />
))

TableFoot.displayName = 'TableFoot'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, forwardedRef) => (
  <caption
    ref={forwardedRef}
    className={cx('mt-3 px-3 text-center text-sm', 'text-gray-500 dark:text-gray-500', className)}
    {...props}
  />
))

TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFoot,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
}
