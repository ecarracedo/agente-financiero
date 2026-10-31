/**
 * Rendering of canonical monetary strings together with their currency.
 *
 * Amounts stay strings end to end: they are never parsed into numbers, so the
 * sign is read from the string's own leading character rather than from a
 * numeric conversion. The backend's `format_money` emits a minus for negatives
 * and nothing for positives, so a gain arrives unsigned and its `+` is added
 * here.
 *
 * A gain and a loss must be distinguishable without colour. Each carries a sign
 * and a `data-trend` cue on the value itself, so the direction survives greyscale
 * and is present in the markup for a test to assert.
 */

/** Label shown when a monetary value is explicitly unavailable. */
export const NOT_AVAILABLE = 'Not available'

/** Direction a gain/loss value points in, or no direction for zero. */
export type Trend = 'up' | 'down' | 'flat'

export interface CurrencyAmountProps {
  /** Canonical amount string, or `null` when the backend cannot price it. */
  amount: string | null
  /** ISO currency code always displayed next to the amount. */
  currency: string
  /**
   * Set to `gain-loss` for a value that is a gain or a loss.
   *
   * Opt-in, because a plain amount such as an invested total is not a direction
   * and must not be given a sign it does not have.
   */
  variant?: 'plain' | 'gain-loss'
}

/** Read the direction of a canonical amount string. */
function trendOf(amount: string): Trend {
  // A canonical zero is not a gain: it must not claim a direction.
  if (/^-?0(\.0+)?$/.test(amount)) return 'flat'
  return amount.startsWith('-') ? 'down' : 'up'
}

/**
 * Render an amount with its currency, or a neutral unavailable label.
 *
 * Under `variant="gain-loss"` the value also carries its sign and a `data-trend`
 * attribute, so a gain and a loss are told apart by more than colour.
 */
export function CurrencyAmount({ amount, currency, variant = 'plain' }: CurrencyAmountProps) {
  if (amount === null) {
    return <span>{NOT_AVAILABLE}</span>
  }

  if (variant === 'plain') {
    return (
      <span>
        {amount} {currency}
      </span>
    )
  }

  const trend = trendOf(amount)
  // The backend already sends the minus for a loss; only a gain needs one added.
  const signed = trend === 'up' ? `+${amount}` : amount
  const colorClass =
    trend === 'up'
      ? 'text-[#46fa9c]'
      : trend === 'down'
        ? 'text-[#ffb4ab]'
        : 'text-[#869397]'

  return (
    <span data-trend={trend} className={`font-mono tabular-nums ${colorClass}`}>
      {signed} {currency}
      <span aria-hidden="true"> {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '='}</span>
    </span>
  )
}
