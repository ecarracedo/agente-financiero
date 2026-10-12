/**
 * Rendering of canonical monetary strings together with their currency.
 */

/** Label shown when a monetary value is explicitly unavailable. */
export const NOT_AVAILABLE = 'Not available'

export interface CurrencyAmountProps {
  /** Canonical amount string, or `null` when the backend cannot price it. */
  amount: string | null
  /** ISO currency code always displayed next to the amount. */
  currency: string
}

/**
 * Render an amount with its currency, or a neutral unavailable label.
 *
 * Amounts stay strings end to end: they are never parsed into numbers.
 */
export function CurrencyAmount({ amount, currency }: CurrencyAmountProps) {
  if (amount === null) {
    return <span>{NOT_AVAILABLE}</span>
  }
  return (
    <span>
      {amount} {currency}
    </span>
  )
}
