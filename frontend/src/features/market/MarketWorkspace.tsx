/**
 * Market workspace: historical chart, overlays, opportunities, and alerts.
 *
 * Hosts the ticker/period/chart-mode selectors, renders the price series with a
 * target line and transaction markers, surfaces unknown market data as an
 * explicit unavailable state (never zero), and mounts the alert panel.
 */

import { useState } from 'react'

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { CurrencyAmount, NOT_AVAILABLE } from '../../components/CurrencyAmount'
import type { SelectOption } from '../../components/FormControls'
import { SelectField, TextField } from '../../components/FormControls'
import { AlertsPanel } from '../alerts/AlertsPanel'
import { MarketChart } from './MarketChart'
import type { ChartMode } from './MarketChart'
import { OpportunityList } from './OpportunityList'
import type { MarketPeriod } from './marketApi'
import { MARKET_PERIODS } from './marketApi'
import { toChartSeries, toTargetValue, toTransactionMarkers } from './series'
import { useMarketAnalysis } from './useMarketAnalysis'
import { useMarketCatalog } from './useMarketCatalog'
import { useTransactionMarkers } from './useTransactionMarkers'

const PERIOD_OPTIONS: SelectOption[] = MARKET_PERIODS.map((period) => ({
  value: period,
  label: period,
}))

const MODE_OPTIONS: SelectOption[] = [
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
]

/** Render the market chart view and its target-alert configuration. */
export function MarketWorkspace() {
  const catalog = useMarketCatalog()
  const [selectedTicker, setSelectedTicker] = useState('')
  const [period, setPeriod] = useState<MarketPeriod>('1y')
  const [mode, setMode] = useState<ChartMode>('line')
  const [searchTicker, setSearchTicker] = useState('')
  const [configuredTargets, setConfiguredTargets] = useState<Record<string, string>>({})

  const activeTicker =
    selectedTicker.trim() !== ''
      ? selectedTicker.trim().toUpperCase()
      : (catalog.entries[0]?.ticker ?? '')

  const selectedEntry =
    catalog.entries.find((entry) => entry.ticker === activeTicker) ?? null

  const analysis = useMarketAnalysis(activeTicker, period)
  const transactions = useTransactionMarkers(
    selectedEntry?.broker ? activeTicker : null,
    selectedEntry?.broker ?? null,
  )

  const tickerOptions: SelectOption[] = catalog.entries.map((entry) => ({
    value: entry.ticker,
    label:
      entry.source === 'portfolio' ? `${entry.ticker} (portfolio)` : `${entry.ticker} (wishlist)`,
  }))

  const currency = selectedEntry?.currency ?? null
  const targetPrice = configuredTargets[activeTicker] ?? selectedEntry?.targetPrice ?? null
  const targetValue = toTargetValue(targetPrice)
  const series = analysis.analysis ? toChartSeries(analysis.analysis.series) : []
  const chartMarkers = toTransactionMarkers(transactions)
  const scope = selectedEntry?.source === 'portfolio' ? 'portfolio' : 'wishlist'

  function handleLoadSearch() {
    const next = searchTicker.trim().toUpperCase()
    if (next !== '') {
      setSelectedTicker(next)
    }
  }

  return (
    <section aria-labelledby="market-heading">
      <h2 id="market-heading">Market</h2>

      {catalog.status === 'loading' ? <LoadingState label="Loading tickers…" /> : null}
      {catalog.status === 'error' ? (
        <ErrorState message={describeApiError(catalog.error)} />
      ) : null}

      <SelectField
        id="market-ticker"
        label="Ticker"
        value={activeTicker}
        options={tickerOptions}
        onChange={setSelectedTicker}
      />
      <TextField
        id="market-search"
        label="Search ticker"
        value={searchTicker}
        onChange={setSearchTicker}
      />
      <button type="button" onClick={handleLoadSearch}>
        Load ticker
      </button>
      <SelectField
        id="market-period"
        label="Period"
        value={period}
        options={PERIOD_OPTIONS}
        onChange={(value) => setPeriod(value as MarketPeriod)}
      />
      <SelectField
        id="market-mode"
        label="Chart mode"
        value={mode}
        options={MODE_OPTIONS}
        onChange={(value) => setMode(value === 'area' ? 'area' : 'line')}
      />

      {analysis.status === 'loading' ? <LoadingState label="Loading market data…" /> : null}
      {analysis.status === 'error' ? (
        <ErrorState message={describeApiError(analysis.error)} />
      ) : null}
      {analysis.status === 'ready' && analysis.analysis ? (
        analysis.analysis.status !== 'OK' || series.length === 0 ? (
          <p role="status">
            {NOT_AVAILABLE}
            {analysis.analysis.reason ? `: ${analysis.analysis.reason}` : ''}
          </p>
        ) : (
          <>
            <p>
              Current price:{' '}
              {currency !== null && currency !== '' ? (
                <CurrencyAmount
                  amount={analysis.analysis.current_price}
                  currency={currency}
                />
              ) : (
                <span>{analysis.analysis.current_price}</span>
              )}
            </p>
            <MarketChart
              series={series}
              mode={mode}
              targetPrice={targetValue}
              targetLabel={
                targetPrice !== null
                  ? `${targetPrice}${currency !== null && currency !== '' ? ` ${currency}` : ''}`
                  : null
              }
              markers={chartMarkers}
            />
            <OpportunityList signals={analysis.analysis.signals} />
          </>
        )
      ) : null}

      {activeTicker !== '' ? (
        <AlertsPanel
          ticker={activeTicker}
          currency={currency}
          broker={selectedEntry?.broker ?? null}
          category={selectedEntry?.category ?? null}
          scope={scope}
          onTargetConfigured={(ticker, savedTarget) =>
            setConfiguredTargets((current) => ({ ...current, [ticker]: savedTarget }))
          }
        />
      ) : null}
    </section>
  )
}
