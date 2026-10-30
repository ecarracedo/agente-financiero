/**
 * Portfolio workspace: executive institutional dashboard matching Obsidian Capital design.
 */

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { Card } from '../../components/tremor/Card'
import { AssetDistributionCard } from './AssetDistributionCard'
import { ExposureAlertCard } from './ExposureAlertCard'
import { HistoricalChartCard } from './HistoricalChartCard'
import { HoldingsTable } from './HoldingsTable'
import { PortfolioSummary } from './PortfolioSummary'
import { QuickOrderCard } from './QuickOrderCard'
import { RecentExecutionsCard } from './RecentExecutionsCard'
import { usePortfolio } from './usePortfolio'
import { ValuationsTable } from './ValuationsTable'

export interface PortfolioWorkspaceProps {
  /** External refetch signal shared by the application shell. */
  refreshToken?: number
}

/** Render the institutional portfolio dashboard. */
export function PortfolioWorkspace({ refreshToken = 0 }: PortfolioWorkspaceProps) {
  const { status, data, error } = usePortfolio(refreshToken)

  return (
    <section aria-labelledby="portfolio-heading" className="space-y-6">
      <h2 id="portfolio-heading" className="sr-only">
        Portfolio
      </h2>
      {status === 'loading' ? <LoadingState label="Loading portfolio…" /> : null}
      {status === 'error' ? <ErrorState message={describeApiError(error)} /> : null}
      {status === 'ready' && data ? (
        <div className="space-y-6">
          {/* Top Institutional Metric Banner */}
          <PortfolioSummary positions={data.positions} valuations={data.valuations} />

          {/* Primary Workspace: 8 cols Chart / 4 cols Quick Order */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 min-w-0">
              <HistoricalChartCard />
            </div>
            <div className="lg:col-span-4">
              <QuickOrderCard />
            </div>
          </div>

          {/* Holdings / Posiciones en Cartera */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">
                  format_list_bulleted
                </span>
                <h3 className="text-base font-semibold font-headline text-white">
                  Posiciones en Cartera
                </h3>
                <span className="bg-[#262a33] text-xs font-mono text-[#bcc9cd] px-2 py-0.5 rounded-full">
                  {data.positions.length} ACTIVOS
                </span>
              </div>
            </div>
            <HoldingsTable positions={data.positions} />
          </Card>

          {/* Bottom Grid: Exposure Warning + Recent Executions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExposureAlertCard />
            <RecentExecutionsCard />
          </div>

          {/* Valuations Table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">query_stats</span>
                <h3 className="text-base font-semibold font-headline text-white">
                  Valuaciones por Moneda
                </h3>
                <span className="bg-[#262a33] text-xs font-mono text-[#bcc9cd] px-2 py-0.5 rounded-full">
                  {data.valuations.length} MONEDAS
                </span>
              </div>
            </div>
            <ValuationsTable valuations={data.valuations} />
          </Card>

          {/* Asset Distribution */}
          <AssetDistributionCard />
        </div>
      ) : null}
    </section>
  )
}
