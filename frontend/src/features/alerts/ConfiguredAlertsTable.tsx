/**
 * Configured-alerts view using the portfolio holdings table layout.
 */

import { useState } from 'react'

import { ErrorState } from '../../components/AsyncStates'
import { formatCurrencyAmount } from '../../lib/money'
import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import { Card } from '../../components/tremor/Card'
import type { ConfiguredAlert } from './alertApi'
import { alertKey, alertOrigin, intentLabel } from './alerts.utils'

type TabFilter = 'all' | 'portfolio' | 'wishlist'

interface ConfiguredAlertsTableProps {
  alerts: ConfiguredAlert[]
  removing: string | null
  error: string | null
  onRemove: (alert: ConfiguredAlert) => void
}

interface MakeColumnsArgs {
  removing: string | null
  onRemove: (alert: ConfiguredAlert) => void
}

/** Available scope filters and their display labels. */
const TABS: ReadonlyArray<{ value: TabFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'portfolio', label: 'Cartera' },
  { value: 'wishlist', label: 'Wishlist' },
]

/** Build the table columns with the action handlers bound to one render. */
function makeColumns({ removing, onRemove }: MakeColumnsArgs): Column<ConfiguredAlert>[] {
  return [
    {
      key: 'ticker',
      header: 'Ticker',
      render: (alert) => (
        <span className="font-bold text-xs text-white font-mono">{alert.ticker}</span>
      ),
    },
    {
      key: 'origin',
      header: 'Origen',
      render: (alert) => (
        <span className="font-mono text-xs text-[#bcc9cd]">{alertOrigin(alert)}</span>
      ),
    },
    {
      key: 'intent',
      header: 'Tipo',
      render: (alert) => (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
            alert.intent === 'BUY'
              ? 'bg-[#46fa9c]/10 text-[#46fa9c] border-[#46fa9c]/30'
              : 'bg-[#ff7f8b]/10 text-[#ff7f8b] border-[#ff7f8b]/30'
          }`}
        >
          {intentLabel(alert.intent)}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Objetivo',
      align: 'center',
      render: (alert) => (
        <span className="font-mono text-xs text-white">
          {formatCurrencyAmount(alert.target_price, alert.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acción',
      align: 'right',
      render: (alert) => {
        const key = alertKey(alert)
        return (
          <button
            type="button"
            onClick={() => onRemove(alert)}
            disabled={removing === key}
            className="px-2 py-1 text-xs font-mono rounded bg-[#ff7f8b]/10 text-[#ff7f8b] border border-[#ff7f8b]/30 hover:bg-[#ff7f8b]/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {removing === key ? 'Eliminando…' : 'Eliminar'}
          </button>
        )
      },
    },
  ]
}

/** Render configured alerts in the same card and table used by portfolio holdings. */
export function ConfiguredAlertsTable({
  alerts,
  removing,
  error,
  onRemove,
}: ConfiguredAlertsTableProps) {
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [searchFilter, setSearchFilter] = useState('')

  const visibleAlerts = alerts.filter((alert) => {
    if (tabFilter !== 'all' && alert.scope !== tabFilter) return false
    const query = searchFilter.trim().toLowerCase()
    if (query === '') return true
    return (
      alert.ticker.toLowerCase().includes(query) ||
      alertOrigin(alert).toLowerCase().includes(query)
    )
  })

  const columns = makeColumns({ removing, onRemove })

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">
            notifications
          </span>
          <h3 className="text-base font-semibold font-headline text-white">
            Alertas configuradas
          </h3>
          <span className="bg-[#262a33] text-xs font-mono text-[#bcc9cd] px-2 py-0.5 rounded-full">
            {alerts.length} ALERTAS
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div
          role="group"
          aria-label="Filtrar alertas"
          className="flex items-center gap-1 bg-[#1c2028] p-1 rounded-lg"
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={tabFilter === tab.value}
              onClick={() => setTabFilter(tab.value)}
              className={`flex-1 py-1 px-3 text-xs font-mono uppercase rounded font-bold transition-all ${
                tabFilter === tab.value
                  ? 'bg-[#06b6d4] text-[#003640]'
                  : 'text-[#bcc9cd] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          aria-label="Filtrar alertas o ticker"
          placeholder="Filtrar alertas o ticker..."
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="w-full sm:w-56 bg-[#1c2028] px-2.5 py-1.5 rounded-lg border border-[#3d494c]/30 text-xs font-mono text-white placeholder:text-[#869397] focus:outline-none"
        />
      </div>

      {error !== null ? <ErrorState message={error} /> : null}

      <DataTable
        caption="Alertas configuradas"
        columns={columns}
        rows={visibleAlerts}
        getRowKey={alertKey}
        emptyMessage="No hay alertas configuradas que coincidan con este filtro."
      />
    </Card>
  )
}
