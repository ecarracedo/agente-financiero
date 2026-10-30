import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TickerSuggestion } from './TickerSearch'
import { TickerSearch } from './TickerSearch'

/**
 * Asset search contract.
 *
 * The control must suggest provider symbols while the user types, let the user
 * pick one with mouse or keyboard, and never block a manually typed symbol when
 * the provider has no match.
 */

const SUGGESTIONS: TickerSuggestion[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', quote_type: 'Equity' },
  { symbol: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYSE', quote_type: 'Equity' },
]

function suggestionsFor(query: string): Promise<TickerSuggestion[]> {
  const term = query.trim().toLowerCase()
  return Promise.resolve(
    SUGGESTIONS.filter(
      (suggestion) =>
        suggestion.symbol.toLowerCase().includes(term) ||
        suggestion.name.toLowerCase().includes(term),
    ),
  )
}

function Harness({
  search = suggestionsFor,
  onSelect,
}: {
  search?: (query: string) => Promise<TickerSuggestion[]>
  onSelect?: (suggestion: TickerSuggestion) => void
}) {
  const [value, setValue] = useState('')
  return (
    <TickerSearch
      label="Activo / Ticker"
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      search={search}
    />
  )
}

describe('TickerSearch', () => {
  it('suggests matching symbols while the user types', async () => {
    render(<Harness />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'app' } })

    expect(await screen.findByRole('option', { name: /AAPL/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /APLE/ })).toBeInTheDocument()
  })

  it('selects a suggestion with the mouse and reports it to the caller', async () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'app' } })
    fireEvent.click(await screen.findByRole('option', { name: /AAPL/ }))

    expect(screen.getByRole('combobox')).toHaveValue('AAPL')
    expect(onSelect).toHaveBeenCalledWith(SUGGESTIONS[0])
    expect(screen.getByText(/Apple Inc\. · NASDAQ/)).toBeInTheDocument()
  })

  it('selects a suggestion with the keyboard', async () => {
    render(<Harness />)

    const combobox = screen.getByRole('combobox')
    fireEvent.change(combobox, { target: { value: 'app' } })
    await screen.findByRole('option', { name: /AAPL/ })

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'Enter' })

    expect(combobox).toHaveValue('AAPL')
  })

  it('keeps a typed symbol when the provider has no match', async () => {
    const search = vi.fn(() => Promise.resolve([]))
    render(<Harness search={search} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ZZZZ' } })

    expect(await screen.findByText(/sin coincidencias/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('ZZZZ')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('closes the suggestion list on Escape', async () => {
    render(<Harness />)

    const combobox = screen.getByRole('combobox')
    fireEvent.change(combobox, { target: { value: 'app' } })
    await screen.findByRole('option', { name: /AAPL/ })

    fireEvent.keyDown(combobox, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('option')).not.toBeInTheDocument()
    })
  })

  it('does not query the provider for a single character', async () => {
    const search = vi.fn(() => Promise.resolve(SUGGESTIONS))
    render(<Harness search={search} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } })

    await waitFor(() => {
      expect(search).not.toHaveBeenCalled()
    })
  })
})
