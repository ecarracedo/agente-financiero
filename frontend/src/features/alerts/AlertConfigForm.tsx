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
  onIntentChange: (intent: AlertIntent) => void
  onTargetPriceChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/** Render the intent selector, target input, and save action. */
export function AlertConfigForm({
  intent,
  targetPrice,
  submitting,
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
      />
      <TextField
        id="alert-target"
        label="Target price"
        value={targetPrice}
        onChange={onTargetPriceChange}
        inputMode="decimal"
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save alert'}
      </button>
    </form>
  )
}
