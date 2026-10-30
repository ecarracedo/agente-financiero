/**
 * Controlled form for configuring a target alert intent and price.
 */

import type { FormEvent } from 'react'

import type { SelectOption } from '../../components/FormControls'
import { SelectField, TextField } from '../../components/FormControls'
import type { AlertIntent } from './alertApi'
import { ALERT_INTENTS } from './alertApi'

const INTENT_OPTIONS: SelectOption[] = ALERT_INTENTS.map((intent) => ({
  value: intent.value,
  label: intent.label,
}))

export interface AlertConfigFormProps {
  /** Currently selected intent. */
  intent: AlertIntent
  /** Current target price input value. */
  targetPrice: string
  /** Whether a save request is in flight. */
  submitting: boolean
  /** Per-field validation errors from the backend (422). */
  fieldErrors?: Record<string, string>
  onIntentChange: (intent: AlertIntent) => void
  onTargetPriceChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/** Render the intent selector, target input, and save action. */
export function AlertConfigForm({
  intent,
  targetPrice,
  submitting,
  fieldErrors = {},
  onIntentChange,
  onTargetPriceChange,
  onSubmit,
}: AlertConfigFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <SelectField
        id="alert-intent"
        label="Intent"
        value={intent}
        options={INTENT_OPTIONS}
        onChange={(value) => onIntentChange(value as AlertIntent)}
        error={fieldErrors.intent}
      />
      <TextField
        id="alert-target"
        label="Target price"
        value={targetPrice}
        onChange={onTargetPriceChange}
        inputMode="decimal"
        error={fieldErrors.target_price}
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[#06b6d4] px-4 py-2 text-sm font-semibold text-[#003640] hover:bg-[#4cd7f6] disabled:opacity-50 transition-all shadow-md"
      >
        {submitting ? 'Saving…' : 'Save alert'}
      </button>
    </form>
  )
}
