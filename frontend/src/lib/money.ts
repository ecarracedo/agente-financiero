/**
 * Shared money formatting for canonical amount strings.
 *
 * Amounts stay strings end to end; formatting happens only at render time so
 * decimal precision is never lost to a numeric conversion.
 */

/** Format an amount as `$ 1.000,00 CODE`, omitting an unknown currency code. */
export function formatCurrencyAmount(
  amount: string,
  currency: string | null | undefined,
): string {
  const numeric = Number(amount)
  const formatted = Number.isFinite(numeric)
    ? numeric.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : amount
  return currency ? `$ ${formatted} ${currency}` : `$ ${formatted}`
}
