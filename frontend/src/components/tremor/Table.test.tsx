import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRoot,
} from './Table'

/**
 * Compatibility probe for the vendored Tremor Raw Table under React 19.
 *
 * The vendored Table uses `React.forwardRef` and `React.ComponentPropsWithoutRef`,
 * and is the primitive five existing table components will be rebuilt on. This
 * test proves it mounts, keeps its semantic structure accessible, forwards a ref,
 * and lets a caller override its classes.
 */
describe('Tremor Table (vendored)', () => {
  function renderTable() {
    return render(
      <TableRoot data-testid="root">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Ticker</TableHeaderCell>
              <TableHeaderCell>Value</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>AAPL</TableCell>
              <TableCell>1234.50</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableRoot>,
    )
  }

  it('renders rows as a real table, keeping header and cell roles', () => {
    renderTable()

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Ticker' })).toHaveAttribute(
      'scope',
      'col',
    )
    expect(screen.getByRole('cell', { name: 'AAPL' })).toBeInTheDocument()
  })

  it('applies the Tremor base classes so Tailwind has something to style', () => {
    renderTable()

    const table = screen.getByRole('table')
    expect(table.className).toContain('w-full')
    expect(table.className).toContain('border-b')
    expect(table.getAttribute('tremor-id')).toBe('tremor-raw')

    expect(screen.getByRole('columnheader', { name: 'Ticker' }).className).toContain(
      'font-semibold',
    )
    expect(screen.getByRole('cell', { name: 'AAPL' }).className).toContain('p-4')
  })

  it('makes the table scrollable on a narrow viewport', () => {
    renderTable()

    // `TableRoot` puts the scroll classes on the element that receives the
    // remaining props, which is where a caller-supplied test id lands.
    expect(screen.getByTestId('root').className).toContain('overflow-auto')
  })

  it('lets a consumer class override a base class', () => {
    render(
      <Table data-testid="table" className="w-auto">
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    // `w-full` base and `w-auto` override must not both remain.
    expect(screen.getByTestId('table').className).toContain('w-auto')
    expect(screen.getByTestId('table').className).not.toContain('w-full')
  })

  it('forwards a ref to the underlying element under React 19', () => {
    const ref = { current: null as HTMLTableElement | null }
    render(
      <Table ref={ref}>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    expect(ref.current).toBeInstanceOf(HTMLTableElement)
  })
})
