/**
 * Target-alert panel: configure an intent and inspect its crossing state.
 *
 * A crossing is never re-emitted client-side: the displayed state reflects only
 * the `event` returned by the API check, and a missing market price is shown as
 * unavailable rather than as zero.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import { describeApiError } from '../../api/errors'
import { ApiError } from '../../api/http'
import { ErrorState, SuccessState } from '../../components/AsyncStates'
import { Card } from '../../components/tremor/Card'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import { AlertConfigForm } from './AlertConfigForm'
import type { AlertIntent } from './alertApi'
import { alertApi } from './alertApi'

export interface AlertsPanelProps {
  /** Ticker whose alert is configured and checked. */
  ticker: string
  /** Currency of the position, or `null` for a wishlist entry without one. */
  currency: string | null
  /** Broker and category identify a portfolio position; unused for wishlist. */
  broker?: string | null
  category?: string | null
  /** Which alert endpoints to use. */
  scope: 'portfolio' | 'wishlist'
  /** Alert already configured for this target, used to prefill the form. */
  alert?: { target_price: string; intent: AlertIntent } | null
  /** Initial target price to display when no alert is configured yet. */
  initialTargetPrice?: string
  /** Notify the host that a target was saved so the chart can overlay it. */
  onTargetConfigured?: (ticker: string, targetPrice: string) => void
}

/** Map a FastAPI validation detail to a field-specific message. */
function fieldErrorFromDetail(detail: unknown, field: string): string | undefined {
  if (Array.isArray(detail)) {
    for (const item of detail) {
      if (item && typeof item === 'object' && 'loc' in item && 'msg' in item) {
        const loc = (item as { loc: unknown }).loc
        if (Array.isArray(loc) && loc[loc.length - 1] === field) {
          return String((item as { msg: unknown }).msg)
        }
      }
    }
  }
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>
    const value = record[field]
    if (typeof value === 'string') return value
  }
  return undefined
}

/** Read the first validation message from an ApiError detail. */
function firstDetailMessage(detail: unknown): string | undefined {
  if (Array.isArray(detail) && detail.length > 0) {
    const item = detail[0]
    if (item && typeof item === 'object' && 'msg' in item) {
      return String((item as { msg: unknown }).msg)
    }
  }
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>
    for (const key of ['message', 'detail']) {
      const value = record[key]
      if (typeof value === 'string') return value
    }
  }
  return undefined
}

/** Configure and check a target alert for one ticker. */
export function AlertsPanel({
  ticker,
  currency,
  broker = null,
  category = null,
  scope,
  alert = null,
  initialTargetPrice,
  onTargetConfigured,
}: AlertsPanelProps) {
  const [intent, setIntent] = useState<AlertIntent>(alert?.intent ?? 'BUY')
  const [editedPrice, setEditedPrice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // The live quote can arrive after this panel mounts, so the target is derived
  // rather than copied into state: a user edit wins, then a saved alert, then
  // the current quote.
  const targetPrice = editedPrice ?? (alert?.target_price ?? initialTargetPrice ?? '')

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)
    setFieldErrors({})
    setSaved(false)
    if (targetPrice.trim() === '') {
      setSaveError('El precio objetivo es obligatorio.')
      setFieldErrors({ target_price: 'El precio objetivo es obligatorio.' })
      return
    }
    setSaving(true)
    try {
      if (scope === 'portfolio') {
        if (broker === null || category === null) {
          throw new Error('portfolio position is required to configure an alert')
        }
        await alertApi.configurePortfolio(ticker, {
          broker,
          category,
          target_price: targetPrice,
          intent,
        })
      } else {
        await alertApi.configureWishlist(ticker, { target_price: targetPrice, intent })
      }
      setSaved(true)
      onTargetConfigured?.(ticker, targetPrice)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const detail = caught.detail
        const next: Record<string, string> = {}
        for (const field of ['target_price', 'price', 'broker', 'category', 'intent', 'ticker']) {
          const message = fieldErrorFromDetail(detail, field)
          if (message) next[field === 'price' ? 'target_price' : field] = message
        }
        if (Object.keys(next).length > 0) {
          setFieldErrors(next)
          return
        }
        const fallback = firstDetailMessage(detail)
        if (fallback) {
          setSaveError(fallback)
          return
        }
      }
      setSaveError(describeApiError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-[#181c24]/80 backdrop-blur-md rounded-xl shadow-md border-[#3d494c]/20">
      <section aria-labelledby="target-alert-heading" className="flex flex-col gap-4">
        <h3 id="target-alert-heading" className="text-base font-semibold text-white font-headline">
          Alerta de precio objetivo
        </h3>
        <AlertConfigForm
          intent={intent}
          targetPrice={targetPrice}
          referencePrice={initialTargetPrice ?? null}
          submitting={saving}
          fieldErrors={fieldErrors}
          onIntentChange={(value) => {
            setIntent(value)
            setSaved(false)
          }}
          onTargetPriceChange={(value) => {
            setEditedPrice(value)
            setSaved(false)
            setFieldErrors((current) => {
              const next = { ...current }
              delete next.target_price
              return next
            })
          }}
          onSubmit={handleSave}
        />
        {initialTargetPrice ? (
          <p className="text-xs font-mono text-[#869397]">
            Cotización actual:{' '}
            {currency !== null && currency !== '' ? (
              <CurrencyAmount amount={initialTargetPrice} currency={currency} />
            ) : (
              <span>{initialTargetPrice}</span>
            )}
          </p>
        ) : null}
        {saved ? <SuccessState message="Alerta guardada." /> : null}
        {saveError ? <ErrorState message={saveError} /> : null}
      </section>
    </Card>
  )
}
