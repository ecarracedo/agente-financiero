import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'

import type { TransactionSummary } from '../../api/client'
import { api } from '../../api/client'

/** How many operations the dashboard widget shows. */
const RECENT_LIMIT = 3

/** Format a money amount with two decimals. */
function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Format a quantity without trailing zeros, capped at six decimals. */
function formatQuantity(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

/**
 * Format the operation timestamp relative to today.
 *
 * The card answers "what happened recently", so today's operations read as
 * `Hoy, HH:MM:SS` and older ones as `dd MMM, HH:MM`, which is shorter than a
 * full date and still unambiguous within a portfolio history.
 */
function formatMoment(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  const time = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) return `Hoy, ${time}`
  const day = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  return `${day}, ${time.slice(0, 5)}`
}

export interface RecentExecutionsCardProps {
  /** External refetch signal, bumped whenever a transaction is recorded. */
  refreshToken?: number
}

/**
 * Recent Executions Card from Obsidian Capital design.
 *
 * Shows the last transactions recorded in the portfolio, newest first, and
 * links to the full transaction workspace.
 */
export function RecentExecutionsCard({ refreshToken = 0 }: RecentExecutionsCardProps) {
  const [executions, setExecutions] = useState<TransactionSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    api
      .listRecentTransactions(RECENT_LIMIT)
      .then((data) => {
        if (!active) return
        setExecutions(data.slice(0, RECENT_LIMIT))
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        console.error('Failed to load recent transactions', error)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [refreshToken])

  return (
    <div
      role="region"
      aria-label="Últimas transacciones"
      className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-3 border border-[#3d494c]/20"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">history</span>
          <h3 className="text-base font-semibold text-white font-headline">Últimas Transacciones</h3>
        </div>
        <NavLink
          to="/transactions"
          className="text-[10px] font-mono uppercase text-[#4cd7f6] hover:underline"
        >
          VER TODAS
        </NavLink>
      </div>

      <div className="flex flex-col gap-2 flex-1 justify-between">
        {status === 'loading' ? (
          <p className="text-[11px] font-mono text-[#869397] py-2">Cargando transacciones…</p>
        ) : null}
        {status === 'error' ? (
          <p className="text-[11px] font-mono text-[#ffb2b7] py-2">
            No se pudieron cargar las transacciones.
          </p>
        ) : null}
        {status === 'ready' && executions.length === 0 ? (
          <p className="text-[11px] font-mono text-[#869397] py-2">Sin transacciones registradas.</p>
        ) : null}
        {executions.map((exec) => {
          const isBuy = exec.operation_type === 'BUY'
          const quantity = Number(exec.quantity)
          const total = quantity * Number(exec.unit_price)
          return (
            <div
              key={exec.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#1c2028]/50 hover:bg-[#1c2028] transition-colors border border-[#3d494c]/20"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-mono font-bold ${
                    isBuy ? 'bg-[#46fa9c]/15 text-[#46fa9c]' : 'bg-[#ff7f8b]/15 text-[#ffb2b7]'
                  }`}
                >
                  {isBuy ? 'BUY' : 'SELL'}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white font-sans">
                    {exec.ticker} • {formatQuantity(quantity)} u.
                  </span>
                  <span className="text-[10px] font-mono text-[#869397]">
                    {formatMoment(exec.occurred_at)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs font-mono font-semibold text-white">
                  {exec.currency} {formatAmount(total)}
                </span>
                <span className="text-[10px] font-mono text-[#869397] font-medium">
                  {exec.broker} · {exec.category}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
