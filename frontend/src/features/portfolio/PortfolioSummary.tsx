/**
 * Compact portfolio summary counts.
 */

import type { CurrencyValuation, PortfolioPosition } from '../../api/client'

export interface PortfolioSummaryProps {
  positions: PortfolioPosition[]
  valuations: CurrencyValuation[]
}

/** Show how many positions and currencies the portfolio currently spans. */
export function PortfolioSummary({ positions, valuations }: PortfolioSummaryProps) {
  return (
    <div>
      <p>Positions: {positions.length}</p>
      <p>Currencies: {valuations.length}</p>
    </div>
  )
}
