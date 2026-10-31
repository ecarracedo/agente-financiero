/**
 * Wishlist table with a per-row target editor and removal action.
 *
 * Target edits stay canonical strings: the draft value is sent verbatim (or as
 * `null` to clear it) and is never parsed into a number.
 */

import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import { TextField } from '../../components/FormControls'
import type { WishlistItem } from './wishlistApi'

export interface WishlistTableProps {
  /** Entries currently stored on the backend. */
  items: WishlistItem[]
  /** In-progress target edits keyed by ticker. */
  drafts: Record<string, string>
  onDraftChange: (ticker: string, value: string) => void
  onSaveTarget: (ticker: string) => void
  onClearTarget: (ticker: string) => void
  onRemove: (ticker: string) => void
}

/** Render one row per entry, each with its own target editor and actions. */
export function WishlistTable({
  items,
  drafts,
  onDraftChange,
  onSaveTarget,
  onClearTarget,
  onRemove,
}: WishlistTableProps) {
  const columns: Column<WishlistItem>[] = [
    { key: 'ticker', header: 'Ticker', render: (item) => item.ticker },
    {
      key: 'target',
      header: 'Target price',
      align: 'right',
      render: (item) =>
        item.target_price === null ? <span>No target</span> : <span>{item.target_price}</span>,
    },
    {
      key: 'target-editor',
      header: 'Set target',
      render: (item) => (
        <TextField
          id={`wishlist-target-${item.ticker}`}
          label={`Target price for ${item.ticker}`}
          value={drafts[item.ticker] ?? item.target_price ?? ''}
          onChange={(value) => onDraftChange(item.ticker, value)}
          inputMode="decimal"
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSaveTarget(item.ticker)}
            aria-label={`Save target for ${item.ticker}`}
            className="rounded-lg bg-[#06b6d4] px-3 py-1.5 text-xs font-semibold text-[#003640] hover:bg-[#4cd7f6] transition-all shadow-xs"
          >
            Save target
          </button>
          <button
            type="button"
            onClick={() => onClearTarget(item.ticker)}
            aria-label={`Clear target for ${item.ticker}`}
            className="rounded-lg border border-[#3d494c]/60 bg-[#1c2028] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#262a33] hover:text-[#4cd7f6] transition-all"
          >
            Clear target
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.ticker)}
            aria-label={`Remove ${item.ticker}`}
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-[#ffb4ab] hover:bg-red-900/30 transition-all"
          >
            Remove
          </button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      caption="Wishlist entries"
      columns={columns}
      rows={items}
      getRowKey={(item) => item.ticker}
      emptyMessage="No wishlist entries."
    />
  )
}
