import { useState } from 'react'

/**
 * Historical performance chart card from Obsidian Capital design.
 */
export function HistoricalChartCard() {
  const [timeframe, setTimeframe] = useState('1M')
  const [showBenchmark, setShowBenchmark] = useState(false)

  const timeframes = ['1D', '1S', '1M', '3M', '1A', 'TODO']

  return (
    <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 relative border border-[#3d494c]/20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">ssid_chart</span>
          <div>
            <h2 className="text-base font-semibold text-white font-headline">
              Rendimiento Histórico Acumulado
            </h2>
            <p className="text-xs text-[#869397]">
              Tasa ponderada en tiempo frente a índice de referencia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBenchmark(!showBenchmark)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              showBenchmark
                ? 'bg-[#262a33] text-white border-[#4cd7f6]/40'
                : 'bg-[#1c2028] text-[#bcc9cd] border-[#3d494c]/30 hover:text-white'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${showBenchmark ? 'bg-[#4cd7f6]' : 'bg-[#869397]'}`}
            />
            <span>vs S&P 500 (+4.82%)</span>
          </button>
          <div className="flex items-center bg-[#0a0e16] p-0.5 rounded-lg border border-[#3d494c]/20">
            {timeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  timeframe === tf
                    ? 'bg-[#262a33] text-[#4cd7f6] font-bold shadow-inner'
                    : 'text-[#869397] hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full h-80 pt-2">
        <div className="absolute top-2 left-1/3 bg-[#262a33]/90 border border-[#3d494c]/30 px-2 py-0.5 rounded shadow-sm text-xs font-mono text-[#46fa9c]">
          MAX: $149,120.40
        </div>
        <div className="absolute bottom-10 left-12 bg-[#262a33]/90 border border-[#3d494c]/30 px-2 py-0.5 rounded shadow-sm text-xs font-mono text-[#869397]">
          MIN: $136,230.30
        </div>
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#46fa9c" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#46fa9c" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#4cd7f6" />
              <stop offset="65%" stopColor="#46fa9c" />
              <stop offset="100%" stopColor="#59ffa4" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <line className="text-[#31353e]/40" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="800" y1="40" y2="40" />
          <line className="text-[#31353e]/40" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="800" y1="100" y2="100" />
          <line className="text-[#31353e]/40" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="800" y1="160" y2="160" />
          <line className="text-[#31353e]/60" stroke="currentColor" strokeWidth="1" x1="0" x2="800" y1="210" y2="210" />
          {showBenchmark ? (
            <path
              d="M 0 190 Q 120 185 240 170 T 480 155 T 680 142 T 800 135"
              fill="none"
              stroke="#869397"
              strokeDasharray="3 3"
              strokeWidth="1.8"
            />
          ) : null}
          <path
            d="M 0 180 C 80 175, 140 160, 200 130 C 260 100, 310 115, 360 85 C 410 55, 470 65, 530 45 C 600 25, 670 50, 740 30 L 800 20 L 800 210 L 0 210 Z"
            fill="url(#chartGradient)"
          />
          <path
            d="M 0 180 C 80 175, 140 160, 200 130 C 260 100, 310 115, 360 85 C 410 55, 470 65, 530 45 C 600 25, 670 50, 740 30 L 800 20"
            fill="none"
            filter="url(#glow)"
            stroke="url(#lineGrad)"
            strokeWidth="2.5"
          />
          <circle cx="800" cy="20" r="4.5" className="fill-[#46fa9c] animate-ping" opacity="0.75" />
          <circle cx="800" cy="20" r="3.5" className="fill-[#46fa9c]" />
        </svg>
      </div>

      <div className="flex justify-between items-center text-xs font-mono text-[#869397] pt-1">
        <span>01 FEB</span>
        <span>07 FEB</span>
        <span>14 FEB</span>
        <span>21 FEB</span>
        <span>28 FEB</span>
        <span className="text-[#46fa9c] font-semibold">HOY (ACTIVO)</span>
      </div>
    </div>
  )
}
