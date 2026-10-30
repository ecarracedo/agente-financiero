import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { describeApiError } from '../../api/errors'
import { localDateTimeValue } from '../../lib/datetime'
import { marketApi } from '../market/marketApi'

export interface QuickOrderCardProps {
  /** Optional callback invoked when a transaction has been successfully created. */
  onTransactionCreated?: () => void
}

const POPULAR_TICKERS = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'Stock' },
  { symbol: 'AAPL', name: 'Apple Inc.', category: 'Stock' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'Stock' },
  { symbol: 'BTC', name: 'Bitcoin Core', category: 'Cripto' },
]

/**
 * Quick order ticket card connected to live yfinance quotes and real transactions.
 */
export function QuickOrderCard({ onTransactionCreated }: QuickOrderCardProps) {
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY')
  const [ticker, setTicker] = useState('NVDA')
  const [quantity, setQuantity] = useState('10')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [quotedTicker, setQuotedTicker] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const symbol = ticker.trim().toUpperCase()
  // Derived, so no state is written synchronously inside the effect.
  const fetchingQuote = symbol !== '' && symbol !== quotedTicker

  const numQty = parseFloat(quantity) || 0
  const numPrice = parseFloat(price) || 0
  const total = (numQty * numPrice).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Fetch the live market price from yfinance whenever the asset changes.
  useEffect(() => {
    if (!symbol) return
    let active = true

    marketApi
      .getAnalysis(symbol, '1mo')
      .then((data) => {
        if (!active) return
        if (data?.current_price) setPrice(data.current_price)
      })
      .catch(() => {
        // Fall back to manual pricing when the provider is unavailable.
      })
      .finally(() => {
        if (active) setQuotedTicker(symbol)
      })

    return () => {
      active = false
    }
  }, [symbol])

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    setError(null)
    if (!symbol || !quantity || !price) {
      setError('Por favor complete activo, cantidad y precio.')
      return
    }

    const matched = POPULAR_TICKERS.find((t) => t.symbol === symbol)
    const category = matched ? matched.category : 'Stock'
    const broker = symbol === 'BTC' ? 'Binance' : 'IBKR'

    setSubmitting(true)
    try {
      await api.createTransaction({
        ticker: symbol,
        broker,
        category,
        operation_type: orderType,
        quantity,
        unit_price: price,
        currency: 'USD',
        occurred_at: localDateTimeValue(),
      })
      setSubmitted(true)
      onTransactionCreated?.()
      setTimeout(() => setSubmitted(false), 3000)
    } catch (caught) {
      setError(describeApiError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-6 shadow-md flex flex-col gap-4 border border-[#3d494c]/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">swap_horiz</span>
          <h3 className="text-base font-semibold text-white font-headline">
            Registrar Transacciones
          </h3>
        </div>
        <span className="text-[10px] font-mono uppercase text-[#46fa9c] font-semibold">
          EJECUCIÓN RÁPIDA
        </span>
      </div>

      <form onSubmit={handleOrder} className="bg-[#0a0e16]/60 p-4 rounded-lg flex flex-col gap-3 border border-[#3d494c]/20">
        <div className="flex items-center gap-1 bg-[#1c2028] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setOrderType('BUY')}
            className={`flex-1 py-1 text-center text-xs font-mono uppercase rounded font-bold transition-all ${
              orderType === 'BUY'
                ? 'bg-[#46fa9c] text-[#00391d]'
                : 'text-[#bcc9cd] hover:text-white'
            }`}
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={() => setOrderType('SELL')}
            className={`flex-1 py-1 text-center text-xs font-mono uppercase rounded font-bold transition-all ${
              orderType === 'SELL'
                ? 'bg-[#ff7f8b] text-[#67001b]'
                : 'text-[#bcc9cd] hover:text-white'
            }`}
          >
            Vender
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#869397] uppercase">Activo / Ticker</span>
            {fetchingQuote ? (
              <span className="text-[10px] font-mono text-[#4cd7f6] animate-pulse">
                Cotizando yfinance…
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between bg-[#1c2028] px-3 py-1.5 rounded-lg border border-[#3d494c]/30">
            <div className="flex items-center gap-2 w-full">
              <span className="px-1.5 py-0.5 rounded bg-[#262a33] text-xs font-mono font-bold text-[#4cd7f6]">
                {ticker}
              </span>
              <select
                aria-label="Seleccionar activo"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value)
                  setPrice('')
                }}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer w-full"
              >
                {POPULAR_TICKERS.map((item) => (
                  <option key={item.symbol} value={item.symbol} className="bg-[#1c2028]">
                    {item.name} ({item.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="quick-order-qty" className="text-[10px] font-mono text-[#869397] uppercase">
              Cantidad
            </label>
            <div className="flex items-center justify-between bg-[#1c2028] px-2.5 py-1.5 rounded-lg border border-[#3d494c]/30">
              <input
                id="quick-order-qty"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                placeholder="0"
              />
              <span className="text-[10px] font-mono text-[#869397] ml-1">SHS</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="quick-order-price" className="text-[10px] font-mono text-[#869397] uppercase">
              Precio / Acción
            </label>
            <div className="flex items-center justify-between bg-[#1c2028] px-2.5 py-1.5 rounded-lg border border-[#3d494c]/30">
              <input
                id="quick-order-price"
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-white focus:outline-none text-right"
                placeholder="0.00"
              />
              <span className="text-[10px] font-mono text-[#869397] ml-1">USD</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#1c2028]/80 px-3 py-2 rounded-lg border border-[#3d494c]/20">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#869397] uppercase">Monto Total Estimado</span>
            <span className="text-xs text-[#bcc9cd]">Comisión FIX: $0.00</span>
          </div>
          <div className="text-right">
            <span className="text-base font-bold font-mono text-white">${total}</span>
            <span className="text-[10px] font-mono text-[#869397] ml-1">USD</span>
          </div>
        </div>

        {error ? (
          <div role="alert" className="text-xs font-mono text-[#ffb4ab] bg-red-950/30 p-2 rounded border border-red-500/20">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#003640] text-xs font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 mt-0.5 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">
            {submitted ? 'check_circle' : 'bolt'}
          </span>
          <span>{submitted ? '¡Transacción Registrada!' : submitting ? 'Registrando…' : 'Registrar Transacción'}</span>
        </button>
      </form>
    </div>
  )
}
