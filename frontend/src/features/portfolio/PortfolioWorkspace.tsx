/**
 * Portfolio workspace: summary, holdings, and currency-grouped valuations.
 */

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { Card } from '../../components/tremor/Card'
import { HoldingsTable } from './HoldingsTable'
import { PortfolioSummary } from './PortfolioSummary'
import { usePortfolio } from './usePortfolio'
import { ValuationsTable } from './ValuationsTable'

export interface PortfolioWorkspaceProps {
  /** External refetch signal shared by the application shell. */
  refreshToken?: number
}

/** Render the portfolio summary, holdings, and valuations/P&L views. */
export function PortfolioWorkspace({ refreshToken = 0 }: PortfolioWorkspaceProps) {
  const { status, data, error } = usePortfolio(refreshToken)

  return (
    <section aria-labelledby="portfolio-heading" className="space-y-6">
      <h2 id="portfolio-heading" className="text-xl font-semibold text-gray-900 dark:text-gray-50">
        Portfolio
      </h2>
      {status === 'loading' ? <LoadingState label="Loading portfolio…" /> : null}
      {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
      {status === 'ready' && data ? (
        <div className="space-y-6">
          <PortfolioSummary positions={data.positions} valuations={data.valuations} />
          <Card>
            <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-50">
              Holdings
            </h3>
            <HoldingsTable positions={data.positions} />
          </Card>
          <Card>
            <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-50">
              Valuations
            </h3>
            <ValuationsTable valuations={data.valuations} />
          </Card>
        </div>
      ) : null}
    </section>
  )
}
