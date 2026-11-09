/**
 * Ticker tape: scrolling continuo tipo calesita.
 * Los símbolos se duplican para que el bucle del translateX sea imperceptible.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'

import { marketApi } from '../features/market/marketApi'
import { readTapeSymbols, subscribeTapeSymbols, tapeLabel } from '../features/settings/tapeSettings'

interface TapeQuote {
  label: string
  price: string
  change: number | null
}

/** Inyecta los keyframes de la calesita una sola vez por sesión. */
let tapeAnimationInjected = false

function useTapeAnimation() {
  useEffect(() => {
    if (tapeAnimationInjected) return
    tapeAnimationInjected = true
    const style = document.createElement('style')
    style.id = 'tape-animation'
    style.textContent = `
      @keyframes tape-scroll {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
    `
    document.head.appendChild(style)
  }, [])
}

/** Ticker tape con desplazamiento continuo (calesita), sin controles. */
export function TickerTape() {
  const symbols = useSyncExternalStore(subscribeTapeSymbols, readTapeSymbols)
  const [quotes, setQuotes] = useState<Record<string, TapeQuote>>({})

  useEffect(() => {
    let active = true
    Promise.all(
      symbols.map(async (symbol) => {
        try {
          const analysis = await marketApi.getAnalysis(symbol, '1mo')
          if (analysis.current_price === null) return null
          const series = analysis.series ?? []
          let change: number | null = null
          if (series.length >= 2) {
            const last = Number(series[series.length - 1].close)
            const prev = Number(series[series.length - 2].close)
            if (Number.isFinite(last) && Number.isFinite(prev) && prev > 0) {
              change = ((last - prev) / prev) * 100
            }
          }
          const quote: TapeQuote = {
            label: tapeLabel(symbol),
            price: Number(analysis.current_price).toLocaleString('es-AR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
            change,
          }
          return [symbol, quote] as const
        } catch {
          return null
        }
      }),
    ).then((entries) => {
      if (!active) return
      setQuotes(Object.fromEntries(entries.filter((e): e is readonly [string, TapeQuote] => e !== null)))
    })
    return () => {
      active = false
    }
  }, [symbols])

  useTapeAnimation()

  // Un ciclo completo dura aprox 3s por símbolo; mínimo 10s.
  const duration = Math.max(10, symbols.length * 3)

  // Se duplica el contenido para que translateX(-50%) devuelva al inicio sin salto visible.
  const doubled = symbols.concat(symbols)

  return (
    <div
      className="hidden xl:flex items-center gap-3 py-1 px-3 rounded-lg bg-[#0a0e16]/60 border border-[#3d494c]/20 overflow-hidden"
    >
      <div
        className="flex gap-3 whitespace-nowrap will-change-transform"
        style={{
          animation: `tape-scroll ${duration}s linear infinite`,
        }}
      >
        {doubled.map((symbol, i) => (
          <div key={`${symbol}-${i}`} className="flex items-center gap-1.5 text-xs font-mono shrink-0">
            <span className="text-[#869397]">{tapeLabel(symbol)}</span>
            <span className="text-white font-medium">
              {quotes[symbol]?.price ?? '—'}
            </span>
            {quotes[symbol]?.change !== null && quotes[symbol]?.change !== undefined ? (
              <span className={quotes[symbol].change >= 0 ? 'text-[#46fa9c] font-semibold' : 'text-[#ff7f8b] font-semibold'}>
                {quotes[symbol].change.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
