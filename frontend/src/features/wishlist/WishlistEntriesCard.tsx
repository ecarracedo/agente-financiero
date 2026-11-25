/**
 * Wishlist entries card using the alert-center table layout.
 */

import { useState } from 'react'

import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { Card } from '../../components/tremor/Card'
import { WishlistTable } from './WishlistTable'
import type { WishlistItem } from './wishlistApi'

interface WishlistEntriesCardProps {
  items: WishlistItem[]
  drafts: Record<string, string>
  loading: boolean
  errorMessage: string | null
  onDraftChange: (ticker: string, value: string) => void
  onSaveTarget: (ticker: string) => void
  onClearTarget: (ticker: string) => void
  onRemove: (ticker: string) => void
  onAnalyze: (ticker: string) => void
}

/** Render the card, its filter toolbar and the entries table. */
export function WishlistEntriesCard({
  items,
  drafts,
  loading,
  errorMessage,
  onDraftChange,
  onSaveTarget,
  onClearTarget,
  onRemove,
  onAnalyze,
}: WishlistEntriesCardProps) {
  const [filter, setFilter] = useState('')
  const query = filter.trim().toLowerCase()
  const visibleItems =
    query === ''
      ? items
      : items.filter((item) => item.ticker.toLowerCase().includes(query))

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">
            format_list_bulleted
          </span>
          <h3 className="text-base font-semibold font-headline text-white">
            Activos en Wishlist
          </h3>
          <span className="bg-[#262a33] text-xs font-mono text-[#bcc9cd] px-2 py-0.5 rounded-full">
            {items.length} ACTIVOS
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <input
          type="text"
          aria-label="Filtrar activos"
          placeholder="Filtrar activos..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-full sm:w-56 bg-[#1c2028] px-2.5 py-1.5 rounded-lg border border-[#3d494c]/30 text-xs font-mono text-white placeholder:text-[#869397] focus:outline-none"
        />
      </div>

      {loading ? <LoadingState label="Loading wishlist…" /> : null}
      {errorMessage !== null ? <ErrorState message={errorMessage} /> : null}

      {!loading && errorMessage === null ? (
        <WishlistTable
          items={visibleItems}
          drafts={drafts}
          onDraftChange={onDraftChange}
          onSaveTarget={onSaveTarget}
          onClearTarget={onClearTarget}
          onRemove={onRemove}
          onAnalyze={onAnalyze}
        />
      ) : null}
    </Card>
  )
}
