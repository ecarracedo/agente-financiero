import { useState, useEffect, useCallback } from 'react'

import { api } from '../../api/client'

/**
 * Historical performance chart card.
 *
 * Consumes `GET /api/v1/portfolio/snapshots` and renders the accumulated
 * performance curve from daily portfolio value snapshots. No benchmark line
 * is shown.
 */
export function HistoricalChartCard() {
  const [snapshots, setSnapshots] = useState<Array<{
    date: string
    value: number
    cumulativeReturn: number
  }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const points = await api.getPortfolioSnapshots()
        if (!active) return
        const parsed = points.map((p) => ({
          date: p.date,
          value: Number(p.value),
          cumulativeReturn: Number(p.cumulative_return),
        }))
        setSnapshots(parsed)
      } catch (caught) {
        if (!active) return
        setError(caught)
        setSnapshots(null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const formatMoney = useCallback((value: number): string => {
    const parts = value.toFixed(2).split('.')
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `$ ${integerPart},${parts[1]}`
  }, [])

  const maxValue = snapshots ? Math.max(...snapshots.map((d) => d.value)) : 0
  const minValue = snapshots ? Math.min(...snapshots.map((d) => d.value)) : 0
  const firstValue = snapshots?.[0]?.value
  const lastValue = snapshots?.[snapshots.length - 1]?.value
  const cumulativeReturn = firstValue && firstValue > 0 ? (lastValue! / firstValue - 1) * 100 : 0

  if (loading) {
    return (
      <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 relative border border-[#3d494c]/20">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">ssid_chart</span>
          <div>
            <h2 className="text-base font-semibold text-white font-headline">
              Rendimiento Histórico Acumulado
            </h2>
            <p className="text-xs text-[#869397]">Cargando historial…</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-xs text-[#869397]">
          Cargando rendimiento acumulado…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 relative border border-[#3d494c]/20">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">ssid_chart</span>
          <div>
            <h2 className="text-base font-semibold text-white font-headline">
              Rendimiento Histórico Acumulado
            </h2>
            <p className="text-xs text-[#869397]">Error al cargar el historial</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-xs text-[#869397]">
          No se pudo obtener el rendimiento acumulado.
        </div>
      </div>
    )
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 relative border border-[#3d494c]/20">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">ssid_chart</span>
          <div>
            <h2 className="text-base font-semibold text-white font-headline">
              Rendimiento Histórico Acumulado
            </h2>
            <p className="text-xs text-[#869397]">Sin historial disponible</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-xs text-[#869397]">
          No hay snapshots diarios para mostrar.
        </div>
      </div>
    )
  }

  // SVG layout constants
  const width = 800
  const height = 240
  const topY = 40
  const bottomY = 210
  const yAxisWidth = 70 // espacio para las etiquetas del eje Y
  const padding = (maxValue - minValue) * 0.1 || maxValue * 0.1 || 1
  const yMax = maxValue + padding
  const yMin = minValue - padding

  const xStep = snapshots.length > 1 ? (width - yAxisWidth) / (snapshots.length - 1) : 0

  const yForValue = (value: number): number => {
    const ratio = (value - yMin) / (yMax - yMin)
    return bottomY - ratio * (bottomY - topY)
  }

  // 4 niveles del eje Y: MIN, dos intermedios, MAX
  const yAxisLevels = snapshots.length > 1
    ? [minValue, minValue + (maxValue - minValue) / 3, minValue + 2 * (maxValue - minValue) / 3, maxValue]
    : [minValue, maxValue]

  // Build line path
  const linePoints = snapshots.map((d, i) => {
    const x = yAxisWidth + i * xStep
    const y = yForValue(d.value)
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).join(' ')

  // Area path: line down to bottom, then back along bottom
  const areaPoints = snapshots.map((d, i) => {
    const x = yAxisWidth + i * xStep
    const y = yForValue(d.value)
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).concat([`L ${width} ${bottomY}`, `L ${yAxisWidth} ${bottomY}`, 'Z']).join(' ')

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
              Valor reconstruido desde snapshots diarios del portafolio
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full h-80 pt-2">
        <div className="absolute top-2 left-1/3 bg-[#262a33]/90 border border-[#3d494c]/30 px-2 py-0.5 rounded shadow-sm text-xs font-mono text-[#46fa9c]">
          MAX: {formatMoney(maxValue)}
        </div>
        <div className="absolute bottom-10 left-12 bg-[#262a33]/90 border border-[#3d494c]/30 px-2 py-0.5 rounded shadow-sm text-xs font-mono text-[#869397]">
          MIN: {formatMoney(minValue)}
        </div>
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
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
          </defs>
          {/* Eje Y: etiquetas y líneas de referencia */}
          {yAxisLevels.map((val, i) => {
            const y = yForValue(val)
            return (
              <g key={i}>
                <line
                  x1={yAxisWidth}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke="#31353e"
                  strokeOpacity={0.35}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <text
                  x={yAxisWidth - 6}
                  y={y + 4}
                  textAnchor="end"
                  fill="#869397"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {formatMoney(val)}
                </text>
              </g>
            )
          })}
          {snapshots.length > 1 && (
            <>
              <path d={areaPoints} fill="url(#chartGradient)" />
              <path d={linePoints} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" />
              <circle cx={width} cy={yForValue(lastValue!)} r="3.5" className="fill-[#46fa9c]" />
            </>
          )}
        </svg>
      </div>

      <div className="flex justify-between items-center text-xs font-mono text-[#869397] pt-1">
        <span>{snapshots[0].date}</span>
        <span>{snapshots[Math.floor(snapshots.length / 2)].date}</span>
        <span>{snapshots[snapshots.length - 1].date}</span>
        <span className={`text-xs font-mono ${cumulativeReturn >= 0 ? 'text-[#46fa9c]' : 'text-[#ff6b6b]'}`}>
          {cumulativeReturn >= 0 ? '+' : ''}{cumulativeReturn.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
