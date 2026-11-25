/**
 * Wishlist table using the configured-alerts table layout.
 *
 * Columns and cell tokens mirror `ConfiguredAlertsTable` so both cards read as
 * the same surface. Target edits stay canonical strings: the draft value is
 * sent verbatim (or as `null` to clear it) and is never parsed into a number.
 */

import type { Column } from '../../components/DataTable'
import { formatCurrencyAmount } from '../../lib/money'
import { DataTable } from '../../components/DataTable'
import { TextField } from '../../components/FormControls'
import { intentLabel } from '../alerts/alerts.utils'
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
  /** Open the analysis card for a ticker. */
  onAnalyze: (ticker: string) => void
}

/** Render one row per entry with the alert table's visual language. */
export function WishlistTable({
  items,
  drafts,
  onDraftChange,
  onSaveTarget,
  onClearTarget,
  onRemove,
  onAnalyze,
}: WishlistTableProps) {
  const columns: Column<WishlistItem>[] = [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (item) => (
        <span className="font-bold text-xs text-white font-mono">{item.ticker}</span>
      ),
    },
    {
      key: 'origin',
      header: 'Origen',
      render: () => <span className="font-mono text-xs text-[#bcc9cd]">Wishlist</span>,
    },
    {
      key: 'intent',
      header: 'Tipo',
      render: (item) =>
        item.alert_intent === 'BUY' || item.alert_intent === 'SELL' ? (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              item.alert_intent === 'BUY'
                ? 'bg-[#46fa9c]/10 text-[#46fa9c] border-[#46fa9c]/30'
                : 'bg-[#ff7f8b]/10 text-[#ff7f8b] border-[#ff7f8b]/30'
            }`}
          >
            {intentLabel(item.alert_intent)}
          </span>
        ) : (
          <span className="font-mono text-xs text-[#869397]">—</span>
        ),
    },
    {
      key: 'target',
      header: 'Objetivo',
      align: 'right',
      render: (item) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-white">
            {item.target_price === null ? (
              <span className="text-[#869397]">No target</span>
            ) : (
              formatCurrencyAmount(item.target_price, item.currency)
            )}
          </span>
          <TextField
            id={`wishlist-target-${item.ticker}`}
            label={`Target price for ${item.ticker}`}
            value={drafts[item.ticker] ?? item.target_price ?? ''}
            onChange={(value) => onDraftChange(item.ticker, value)}
            inputMode="decimal"
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acción',
      align: 'right',
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onAnalyze(item.ticker)}
            aria-label={`Analyze ${item.ticker}`}
            className="px-2 py-1 text-xs font-mono rounded bg-[#1c2028] text-[#bcc9cd] border border-[#3d494c]/30 hover:text-white"
          >
            Analyze
          </button>
          <button
            type="button"
            onClick={() => onSaveTarget(item.ticker)}
            aria-label={`Save target for ${item.ticker}`}
            className="px-2 py-1 text-xs font-mono rounded bg-[#06b6d4] text-[#003640] hover:bg-[#4cd7f6]"
          >
            Save target
          </button>
          <button
            type="button"
            onClick={() => onClearTarget(item.ticker)}
            aria-label={`Clear target for ${item.ticker}`}
            className="px-2 py-1 text-xs font-mono rounded bg-[#1c2028] text-[#bcc9cd] border border-[#3d494c]/30 hover:text-white"
          >
            Clear target
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.ticker)}
            aria-label={`Remove ${item.ticker}`}
            className="px-2 py-1 text-xs font-mono rounded bg-[#ff7f8b]/10 text-[#ff7f8b] border border-[#ff7f8b]/30 hover:bg-[#ff7f8b]/20"
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
