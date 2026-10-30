/**
 * Free-text asset search with provider-backed suggestions.
 *
 * The control is a combobox: the user may type any symbol and submit it
 * unchanged, or pick one of the suggested instruments. Suggestions are only a
 * convenience, so a provider failure never blocks manual entry.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/** One suggested instrument. */
export interface TickerSuggestion {
  symbol: string
  name: string
  exchange: string
  quote_type: string
}

/** Shortest query that triggers a provider lookup. */
export const MIN_TICKER_QUERY_LENGTH = 2

/** Delay before a keystroke becomes a provider lookup. */
const DEBOUNCE_MS = 300

export interface TickerSearchProps {
  id?: string
  label: string
  /** Current ticker text, controlled by the caller. */
  value: string
  /** Called on every keystroke with the raw input. */
  onChange: (value: string) => void
  /** Called when the user picks a suggestion. */
  onSelect?: (suggestion: TickerSuggestion) => void
  /** Provider lookup. Must be referentially stable. */
  search: (query: string) => Promise<TickerSuggestion[]>
  /** Validation failure; marks the field invalid and is linked to it. */
  error?: string
  /** Short status shown beside the label. */
  hint?: ReactNode
}

/** Labeled combobox that suggests provider symbols while the user types. */
export function TickerSearch({
  id,
  label,
  value,
  onChange,
  onSelect,
  search,
  error,
  hint,
}: TickerSearchProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-listbox`
  const errorId = `${inputId}-error`

  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([])
  const [suggestedQuery, setSuggestedQuery] = useState<string | null>(null)
  const [selection, setSelection] = useState<TickerSuggestion | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // The lookup is read from a ref so an inline `search` callback cannot restart
  // the debounce on every render.
  const searchRef = useRef(search)
  useEffect(() => {
    searchRef.current = search
  }, [search])

  const query = value.trim()
  const visible =
    query.length >= MIN_TICKER_QUERY_LENGTH && suggestedQuery === query ? suggestions : []
  const loading = open && query.length >= MIN_TICKER_QUERY_LENGTH && suggestedQuery !== query

  useEffect(() => {
    if (!open) return
    if (query.length < MIN_TICKER_QUERY_LENGTH) return

    let active = true
    const timer = setTimeout(() => {
      searchRef
        .current(query)
        .then((matches) => {
          if (!active) return
          setSuggestions(matches)
          setSuggestedQuery(query)
          setActiveIndex(-1)
        })
        .catch(() => {
          if (!active) return
          setSuggestions([])
          setSuggestedQuery(query)
        })
    }, DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, query])

  function handleInput(next: string) {
    setOpen(true)
    setActiveIndex(-1)
    onChange(next)
  }

  function choose(suggestion: TickerSuggestion) {
    setOpen(false)
    setActiveIndex(-1)
    setSelection(suggestion)
    onChange(suggestion.symbol)
    onSelect?.(suggestion)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (visible.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index + 1) % visible.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? visible.length - 1 : index - 1))
      return
    }
    if (event.key === 'Enter' && activeIndex >= 0 && visible[activeIndex]) {
      event.preventDefault()
      choose(visible[activeIndex])
    }
  }

  const selected =
    selection && selection.symbol === query.toUpperCase() ? selection : null

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-[#bcc9cd] font-mono"
        >
          {label}
        </label>
        {hint}
      </div>
      <div className="mt-1 flex items-center gap-2 bg-[#1c2028] px-3 py-2 rounded-lg border border-[#3d494c]/60 focus-within:border-[#4cd7f6] transition-all">
        <span className="material-symbols-outlined text-[16px] text-[#869397]">search</span>
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open && visible.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && visible[activeIndex]
              ? `${inputId}-option-${activeIndex}`
              : undefined
          }
          aria-invalid={error !== undefined ? true : undefined}
          aria-describedby={error !== undefined ? errorId : undefined}
          value={value}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="Buscar activo…"
          className="w-full bg-transparent text-sm font-mono uppercase text-white placeholder-[#869397] focus:outline-none"
        />
      </div>

      {selected && !open ? (
        <p className="mt-1 text-[10px] font-mono text-[#869397] truncate">
          {selected.name}
          {selected.exchange ? ` · ${selected.exchange}` : ''}
        </p>
      ) : null}

      {error !== undefined ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[#ffb4ab]">
          {error}
        </p>
      ) : null}

      {open && visible.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Sugerencias de activos"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[#3d494c]/60 bg-[#181c24] shadow-xl"
        >
          {visible.map((suggestion, index) => (
            <li
              key={suggestion.symbol}
              id={`${inputId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-xs ${
                index === activeIndex ? 'bg-[#262a33]' : ''
              }`}
            >
              <span className="font-mono font-bold text-[#4cd7f6]">{suggestion.symbol}</span>
              <span className="flex-1 truncate text-[#bcc9cd]">{suggestion.name}</span>
              <span className="font-mono text-[10px] uppercase text-[#869397]">
                {suggestion.exchange}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !loading && query.length >= MIN_TICKER_QUERY_LENGTH && visible.length === 0 ? (
        <p role="status" className="mt-1 text-[10px] font-mono text-[#869397]">
          Sin coincidencias: se usará el símbolo escrito.
        </p>
      ) : null}
    </div>
  )
}
