/**
 * Compact portfolio summary counts with Stitch Obsidian institutional layout.
 */

import type { CurrencyValuation, PortfolioPosition } from '../../api/client'
import { Card } from '../../components/tremor/Card'

export interface PortfolioSummaryProps {
  positions: PortfolioPosition[]
  valuations: CurrencyValuation[]
}

/** Show institutional portfolio totals and summary metrics. */
export function PortfolioSummary({ positions, valuations }: PortfolioSummaryProps) {
  const primaryValuation = valuations.find((v) => v.currency === 'USD') ?? valuations[0]
  const totalValue = primaryValuation?.market_value ?? primaryValuation?.invested_value ?? null
  const gainPercent = primaryValuation?.gain_loss_percent ?? null

  return (
    <Card className="relative overflow-hidden border border-[#3d494c]/30 p-6 lg:p-8">
      {/* Background radial glows from Stitch */}
      <div className="absolute -right-20 -top-24 w-96 h-96 bg-[#4cd7f6]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-24 w-96 h-96 bg-[#46fa9c]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Main Portfolio Total */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono">
              PORTAFOLIO INSTITUCIONAL
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#262a33] text-[10px] font-mono font-semibold text-[#4cd7f6]">
              FIXED ENGINE ONLINE
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl lg:text-4xl font-bold font-mono text-white tracking-tight">
              {totalValue ? `$ ${Number(totalValue).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              <span className="text-sm font-normal text-[#869397] ml-2">
                {primaryValuation?.currency ?? 'USD'}
              </span>
            </h1>
            {gainPercent !== null ? (
              <div className="flex items-center gap-1.5 bg-[#46fa9c]/10 border border-[#46fa9c]/20 px-2.5 py-1 rounded-lg">
                <span className="material-symbols-outlined text-[#46fa9c] text-[16px]">trending_up</span>
                <span className="text-xs font-mono font-semibold text-[#46fa9c]">
                  +{gainPercent}%
                </span>
                <span className="text-[10px] font-mono text-[#869397] ml-1">TOTAL</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 bg-[#262a33] px-2.5 py-1 rounded-lg">
              <span className="text-[10px] font-mono text-[#bcc9cd]">24H:</span>
              <span className="text-xs font-mono font-medium text-[#46fa9c]">+1.25%</span>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Cluster in DL for semantic compliance */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-[#1c2028]/70 p-3.5 rounded-lg flex flex-col justify-center border border-[#3d494c]/20">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono mb-1">
              Positions
            </dt>
            <dd className="text-xl font-bold font-mono text-white">
              {positions.length}
            </dd>
            <span className="text-[10px] font-mono text-[#869397] mt-0.5">ACTIVAS EN CARTERA</span>
          </div>

          <div className="bg-[#1c2028]/70 p-3.5 rounded-lg flex flex-col justify-center border border-[#3d494c]/20">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono mb-1">
              Currencies
            </dt>
            <dd className="text-xl font-bold font-mono text-[#4cd7f6]">
              {valuations.length}
            </dd>
            <span className="text-[10px] font-mono text-[#869397] mt-0.5">GRUPOS DE VALOR</span>
          </div>

          <div className="bg-[#1c2028]/70 p-3.5 rounded-lg flex flex-col justify-center border border-[#3d494c]/20 col-span-2 sm:col-span-1">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#869397] font-mono mb-1">
              Poder de Compra
            </dt>
            <dd className="text-xl font-bold font-mono text-[#46fa9c]">
              $28,500.00
            </dd>
            <span className="text-[10px] font-mono text-[#869397] mt-0.5">COLATERAL FIAT</span>
          </div>
        </dl>
      </div>
    </Card>
  )
}
