/**
 * Wishlist workspace in Obsidian Capital design system.
 *
 * Mirrors the Alert Center layout: a sticky add card on the left and the
 * configured entries table on the right. Every mutation refreshes the list
 * from the backend so the rendered state is always the persisted state.
 * Backend failures (duplicate 409, missing 404) are surfaced through
 * {@link describeApiError} and never shown as success.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import { describeApiError } from '../../api/errors'
import { WishlistAddCard } from './WishlistAddCard'
import { WishlistAnalysis } from './WishlistAnalysis'
import { WishlistEntriesCard } from './WishlistEntriesCard'
import { useWishlist } from './useWishlist'
import { wishlistApi } from './wishlistApi'

/** Track, retarget, and remove wishlist entries. */
export function WishlistWorkspace() {
  const [version, setVersion] = useState(0)
  const { status, items, error } = useWishlist(version)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [ticker, setTicker] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [analyzed, setAnalyzed] = useState<string | null>(null)

  function handleDraftChange(target: string, value: string) {
    setDrafts((current) => ({ ...current, [target]: value }))
  }

  function dropDraft(target: string) {
    setDrafts((current) => {
      if (!(target in current)) return current
      const next = { ...current }
      delete next[target]
      return next
    })
  }

  async function run(action: () => Promise<void>) {
    setActionError(null)
    setMessage(null)
    try {
      await action()
      setVersion((value) => value + 1)
    } catch (caught) {
      setActionError(describeApiError(caught))
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = ticker.trim()
    if (next === '') return
    setMessage(null)
    setActionError(null)
    await run(async () => {
      await wishlistApi.add(next)
      setTicker('')
      setMessage('Ticker added.')
    })
  }

  async function handleSaveTarget(target: string) {
    const stored = items.find((item) => item.ticker === target)?.target_price ?? ''
    const value = (drafts[target] ?? stored).trim()
    setMessage(null)
    setActionError(null)
    await run(async () => {
      await wishlistApi.setTarget(target, value === '' ? null : value)
      dropDraft(target)
      setMessage('Target updated.')
    })
  }

  async function handleClearTarget(target: string) {
    setMessage(null)
    setActionError(null)
    await run(async () => {
      await wishlistApi.setTarget(target, null)
      dropDraft(target)
      setMessage('Target cleared.')
    })
  }

  async function handleRemove(target: string) {
    setMessage(null)
    setActionError(null)
    await run(async () => {
      await wishlistApi.remove(target)
      dropDraft(target)
      setMessage('Ticker removed.')
    })
  }

  const loadErrorMessage = status === 'error' ? describeApiError(error) : null

  return (
    <section aria-labelledby="wishlist-heading" className="space-y-6">
      {/* Top Hero Header: Obsidian Capital Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low/70 backdrop-blur-md p-6 rounded-xl border border-outline-variant/30 shadow-lg relative overflow-hidden">
        <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="space-y-1">
          <h2 id="wishlist-heading" className="text-2xl font-bold tracking-tight text-on-surface">
            Centro de Wishlist
          </h2>
          <p className="text-sm text-on-surface-variant">
            Seguimiento de activos, precios objetivo y análisis en tiempo real.
          </p>
        </div>
      </div>

      {/* Main 2-Column Grid: Add card (col 4-5) & Entries card (col 7-8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 xl:col-span-4">
          <WishlistAddCard
            ticker={ticker}
            error={actionError}
            message={message}
            onTickerChange={setTicker}
            onSubmit={(event) => void handleAdd(event)}
          />
        </div>

        <div className="lg:col-span-7 xl:col-span-8">
          <WishlistEntriesCard
            items={items}
            drafts={drafts}
            loading={status === 'loading'}
            errorMessage={loadErrorMessage}
            onDraftChange={handleDraftChange}
            onSaveTarget={(target) => void handleSaveTarget(target)}
            onClearTarget={(target) => void handleClearTarget(target)}
            onRemove={(target) => void handleRemove(target)}
            onAnalyze={setAnalyzed}
          />
        </div>
      </div>

      {analyzed !== null && items.some((item) => item.ticker === analyzed) ? (
        <WishlistAnalysis ticker={analyzed} onClose={() => setAnalyzed(null)} />
      ) : null}
    </section>
  )
}
