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
import { ErrorState } from '../../components/AsyncStates'
import { CurrencyAmount } from '../../components/CurrencyAmount'
import { AlertConfigForm } from './AlertConfigForm'
import type { AlertCheckState } from './AlertStatus'
import { AlertStatus } from './AlertStatus'
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
  /** Notify the host that a target was saved so the chart can overlay it. */
  onTargetConfigured?: (ticker: string, targetPrice: string) => void
}

/** Configure and check a target alert for one ticker. */
export function AlertsPanel({
  ticker,
  currency,
  broker = null,
  category = null,
  scope,
  onTargetConfigured,
}: AlertsPanelProps) {
  const [intent, setIntent] = useState<AlertIntent>('NEUTRAL')
  const [targetPrice, setTargetPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [checkState, setCheckState] = useState<AlertCheckState>({ kind: 'idle' })

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)
    setSaved(false)
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
      setSaveError(describeApiError(caught))
    } finally {
      setSaving(false)
    }
  }

  async function handleCheck() {
    setCheckState({ kind: 'loading' })
    try {
      const result =
        scope === 'portfolio'
          ? await alertApi.checkPortfolio(ticker, {
              broker: broker ?? '',
              category: category ?? '',
            })
          : await alertApi.checkWishlist(ticker)
      setCheckState(
        result.event
          ? { kind: 'crossing', currentPrice: result.current_price, event: result.event }
          : { kind: 'no-crossing', currentPrice: result.current_price },
      )
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 503) {
        setCheckState({ kind: 'unavailable' })
      } else {
        setCheckState({ kind: 'error', error: caught })
      }
    }
  }

  const observedPrice =
    checkState.kind === 'crossing' || checkState.kind === 'no-crossing'
      ? checkState.currentPrice
      : null

  return (
    <section aria-labelledby="alerts-heading">
      <h3 id="alerts-heading">Target alert</h3>
      <AlertConfigForm
        intent={intent}
        targetPrice={targetPrice}
        submitting={saving}
        onIntentChange={setIntent}
        onTargetPriceChange={setTargetPrice}
        onSubmit={handleSave}
      />
      <button type="button" onClick={handleCheck} disabled={ticker === ''}>
        Check alert
      </button>
      {saved ? <p role="status">Alert saved.</p> : null}
      {saveError ? <ErrorState message={saveError} /> : null}
      {observedPrice !== null ? (
        <p>
          Current price:{' '}
          {currency !== null && currency !== '' ? (
            <CurrencyAmount amount={observedPrice} currency={currency} />
          ) : (
            <span>{observedPrice}</span>
          )}
        </p>
      ) : null}
      <AlertStatus state={checkState} />
    </section>
  )
}
