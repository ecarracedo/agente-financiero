/**
 * Asset Distribution / Donut Allocation Card from Obsidian Capital design.
 */
export function AssetDistributionCard() {
  const assets = [
    {
      name: 'Acciones',
      percentage: '62.0%',
      amount: '$92,163.50',
      delta: '+3.8% 24h',
      subtitle: '2 Activos (NVDA, AAPL)',
      color: '#4cd7f6',
      badgeColor: 'text-[#4cd7f6]',
      dotBg: 'bg-[#4cd7f6]',
    },
    {
      name: 'ETFs',
      percentage: '23.0%',
      amount: '$34,190.00',
      delta: '+0.8% 24h',
      subtitle: '1 Fondo (VOO)',
      color: '#46fa9c',
      badgeColor: 'text-[#46fa9c]',
      dotBg: 'bg-[#46fa9c]',
    },
    {
      name: 'Cripto',
      percentage: '10.0%',
      amount: '$14,865.00',
      delta: '+2.3% 24h',
      subtitle: '1 Activo (BTC)',
      color: '#acedff',
      badgeColor: 'text-[#acedff]',
      dotBg: 'bg-[#acedff]',
    },
    {
      name: 'Efectivo',
      percentage: '5.0%',
      amount: '$7,432.30',
      delta: 'USD FIAT',
      subtitle: 'Colateral Disponible',
      color: '#869397',
      badgeColor: 'text-[#869397]',
      dotBg: 'bg-[#869397]',
    },
  ]

  return (
    <div className="w-full bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20 relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#3d494c]/20 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-[#06b6d4]/10 text-[#4cd7f6] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">donut_large</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white font-headline">
                Distribución de Activos
              </h3>
              <span className="px-2 py-0.5 rounded bg-[#262a33] text-[10px] font-mono text-[#46fa9c] font-semibold uppercase">
                Cartera Balanceada
              </span>
            </div>
            <p className="text-xs text-[#869397]">
              Desglose panorámico de asignación de capital institucional por clase de activo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#869397]">
            <span className="w-2 h-2 rounded-full bg-[#46fa9c] animate-pulse" />
            <span>TIEMPO REAL</span>
          </div>
          <span className="text-xs font-mono font-semibold text-white">
            VALOR TOTAL: $148,650.80
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-1">
        {/* Donut Chart visual */}
        <div className="lg:col-span-3 flex items-center justify-center gap-4 bg-[#0a0e16]/40 p-4 rounded-xl border border-[#3d494c]/20">
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" fill="none" r="15.915" stroke="#1c2028" strokeWidth="3.8" />
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="15.915"
                stroke="#4cd7f6"
                strokeDasharray="62 38"
                strokeDashoffset="0"
                strokeWidth="3.8"
              />
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="15.915"
                stroke="#46fa9c"
                strokeDasharray="23 77"
                strokeDashoffset="-62"
                strokeWidth="3.8"
              />
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="15.915"
                stroke="#acedff"
                strokeDasharray="10 90"
                strokeDashoffset="-85"
                strokeWidth="3.8"
              />
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="15.915"
                stroke="#869397"
                strokeDasharray="5 95"
                strokeDashoffset="-95"
                strokeWidth="3.8"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-[9px] font-mono text-[#869397]">TOTAL</span>
              <span className="text-sm font-bold font-mono text-white">100%</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-[#869397] uppercase">Diversificación</span>
            <span className="text-xs font-mono text-[#46fa9c] font-semibold">Score: 9.4/10</span>
            <span className="text-[10px] text-[#869397]">4 Clases • Riesgo Moderado</span>
          </div>
        </div>

        {/* Breakdown bar & cards */}
        <div className="lg:col-span-9 flex flex-col gap-3">
          {/* Progress bar */}
          <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#0a0e16]">
            <div className="h-full bg-[#4cd7f6]" style={{ width: '62%' }} title="Acciones: 62%" />
            <div className="h-full bg-[#46fa9c]" style={{ width: '23%' }} title="ETFs: 23%" />
            <div className="h-full bg-[#acedff]" style={{ width: '10%' }} title="Cripto: 10%" />
            <div className="h-full bg-[#869397]" style={{ width: '5%' }} title="Efectivo: 5%" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {assets.map((asset) => (
              <div
                key={asset.name}
                className="bg-[#1c2028]/60 p-3 rounded-lg flex flex-col gap-1 border border-[#3d494c]/15"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-[#dfe2ee]">
                    <span className={`w-2 h-2 rounded-full ${asset.dotBg}`} />
                    {asset.name}
                  </span>
                  <span className={`text-xs font-mono font-bold ${asset.badgeColor}`}>
                    {asset.percentage}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-bold font-mono text-white">{asset.amount}</span>
                  <span className="text-[10px] font-mono text-[#46fa9c]">{asset.delta}</span>
                </div>
                <span className="text-[10px] text-[#869397]">{asset.subtitle}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
