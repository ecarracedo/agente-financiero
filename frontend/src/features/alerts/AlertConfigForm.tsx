/**
 * Controlled form for configuring a target alert intent and price.
 *
 * Percentage shortcuts derive the target from the live quote: they add the
 * chosen percentage to that reference and write the resulting price through the
 * same controlled input as a manual edit.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import type { SelectOption } from '../../components/FormControls'
import { SelectField, TextField } from '../../components/FormControls'
import type { AlertIntent } from './alertApi'
import { ALERT_INTENTS } from './alertApi'

const INTENT_OPTIONS: SelectOption[] = ALERT_INTENTS.map((intent) => ({
  value: intent.value,
  label: intent.label,
}))

/** Preset increases offered over the live quote. */
const PERCENT_PRESETS = [25, 50, 75] as const

export interface AlertConfigFormProps {
  /** Currently selected intent. */
  intent: AlertIntent
  /** Current target price input value. */
  targetPrice: string
  /** Live quote used as the reference for percentage increases. */
  referencePrice?: string | null
  /** Whether a save request is in flight. */
  submitting: boolean
  /** Per-field validation errors from the backend (422). */
  fieldErrors?: Record<string, string>
  onIntentChange: (intent: AlertIntent) => void
  onTargetPriceChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

/** Render the intent selector, price controls, and save action. */
export function AlertConfigForm({
  intent,
  targetPrice,
  referencePrice = null,
  submitting,
  fieldErrors = {},
  onIntentChange,
  onTargetPriceChange,
  onSubmit,
}: AlertConfigFormProps) {
  const [customPercent, setCustomPercent] = useState('')

  // Accept both dot and comma decimals so the input matches the locale used
  // elsewhere in the app. A missing or invalid quote disables the shortcuts.
  const reference =
    referencePrice === null || referencePrice.trim() === ''
      ? Number.NaN
      : Number(referencePrice.replace(',', '.'))
  const canAdjust = Number.isFinite(reference) && reference > 0

  function applyPercent(percent: number) {
    if (!canAdjust) return
    onTargetPriceChange((reference * (1 + percent / 100)).toFixed(2))
  }

  function handlePreset(percent: number) {
    setCustomPercent('')
    applyPercent(percent)
  }

  function handleCustomPercent(value: string) {
    setCustomPercent(value)
    const parsed = Number(value.replace(',', '.'))
    if (value.trim() !== '' && Number.isFinite(parsed)) applyPercent(parsed)
  }

  // A manual price edit invalidates the displayed percentage: keeping it would
  // suggest a relationship with a target the user just replaced.
  function handleManualPrice(value: string) {
    setCustomPercent('')
    onTargetPriceChange(value)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <SelectField
        id="alert-intent"
        label="Tipo"
        value={intent}
        options={INTENT_OPTIONS}
        onChange={(value) => onIntentChange(value as AlertIntent)}
        error={fieldErrors.intent}
        density="compact"
      />
      <TextField
        id="alert-target"
        label="Precio objetivo"
        value={targetPrice}
        onChange={handleManualPrice}
        inputMode="decimal"
        error={fieldErrors.target_price}
        density="compact"
      />
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono text-[#869397] uppercase">
          Aumento porcentual
        </span>
        <div className="flex items-center gap-1 bg-[#1c2028] p-1 rounded-lg">
          {PERCENT_PRESETS.map((percent) => (
            <button
              key={percent}
              type="button"
              disabled={!canAdjust}
              onClick={() => handlePreset(percent)}
              className="flex-1 py-1 text-xs font-mono uppercase rounded font-bold transition-all cursor-pointer bg-[#1c2028] text-[#bcc9cd] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              +{percent}%
            </button>
          ))}
          <input
            type="text"
            aria-label="Porcentaje personalizado (%)"
            inputMode="decimal"
            placeholder="Otro %"
            value={customPercent}
            disabled={!canAdjust}
            onChange={(event) => handleCustomPercent(event.target.value)}
            className="w-20 bg-[#1c2028] px-2.5 py-1 rounded-lg border border-[#3d494c]/30 text-xs font-mono text-white focus:outline-none disabled:opacity-40"
          />
        </div>
        <span className="text-[10px] font-mono text-[#869397]">
          Se suma a la cotización actual para fijar el precio objetivo.
        </span>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#003640] text-xs font-semibold rounded-lg shadow-md disabled:opacity-50 transition-all cursor-pointer"
      >
        {submitting ? 'Guardando…' : 'Guardar alerta'}
      </button>
    </form>
  )
}
