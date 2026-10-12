/**
 * Portfolio workspace: summary, holdings, and currency-grouped valuations.
 */

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
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
    <section aria-labelledby="portfolio-heading">
      <h2 id="portfolio-heading">Portfolio</h2>
      {status === 'loading' ? <LoadingState label="Loading portfolio…" /> : null}
      {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
      {status === 'ready' && data ? (
        <>
          <PortfolioSummary positions={data.positions} valuations={data.valuations} />
          <h3>Holdings</h3>
          <HoldingsTable positions={data.positions} />
          <h3>Valuations</h3>
          <ValuationsTable valuations={data.valuations} />
        </>
      ) : null}
    </section>
  )
}
