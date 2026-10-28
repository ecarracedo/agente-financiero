/**
 * Compact portfolio summary counts.
 */

import type { CurrencyValuation, PortfolioPosition } from '../../api/client'
import { Card } from '../../components/tremor/Card'

export interface PortfolioSummaryProps {
  positions: PortfolioPosition[]
  valuations: CurrencyValuation[]
}

/** Show how many positions and currencies the portfolio currently spans. */
export function PortfolioSummary({ positions, valuations }: PortfolioSummaryProps) {
  return (
    <Card>
      <dl className="grid grid-cols-2 gap-6">
        <div>
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Positions</dt>
          <dd className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {positions.length}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Currencies</dt>
          <dd className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {valuations.length}
          </dd>
        </div>
      </dl>
    </Card>
  )
}
