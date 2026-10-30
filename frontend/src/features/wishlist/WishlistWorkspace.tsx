/**
 * Wishlist workspace: add, retarget, and remove wishlist entries.
 *
 * Every mutation refreshes the list from the backend so the rendered state is
 * always the persisted state. Backend failures (duplicate 409, missing 404) are
 * surfaced through {@link describeApiError} and never shown as success.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState, SuccessState } from '../../components/AsyncStates'
import { TextField } from '../../components/FormControls'
import { Card } from '../../components/tremor/Card'
import { WishlistTable } from './WishlistTable'
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

  return (
    <section aria-labelledby="wishlist-heading" className="space-y-4">
      <h2 id="wishlist-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Wishlist
      </h2>

      <Card>
        <form onSubmit={handleAdd} noValidate className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <TextField id="wishlist-ticker" label="Ticker" value={ticker} onChange={setTicker} />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#06b6d4] px-4 py-2 text-sm font-semibold text-[#003640] hover:bg-[#4cd7f6] transition-all shadow-md"
          >
            Add ticker
          </button>
        </form>
      </Card>

      {actionError ? <ErrorState message={actionError} /> : null}
      {message ? <SuccessState message={message} /> : null}

      {status === 'loading' ? <LoadingState label="Loading wishlist…" /> : null}
      {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
      {status === 'ready' ? (
        <Card>
          <WishlistTable
            items={items}
            drafts={drafts}
            onDraftChange={handleDraftChange}
            onSaveTarget={handleSaveTarget}
            onClearTarget={handleClearTarget}
            onRemove={handleRemove}
          />
        </Card>
      ) : null}
    </section>
  )
}
