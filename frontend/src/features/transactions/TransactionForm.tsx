/**
 * Buy/sell operation form.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import type { TransactionRequest } from '../../api/client'
import type { SelectOption } from '../../components/FormControls'
import { SelectField, TextField } from '../../components/FormControls'
import { localDateTimeValue } from '../../lib/datetime'
import { marketApi } from '../market/marketApi'

const OPERATION_OPTIONS: SelectOption[] = [
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
]

export interface TransactionFormProps {
  /** Submit handler; resolves `true` when the operation was accepted. */
  onSubmit: (payload: TransactionRequest) => Promise<boolean>
  /** Per-field validation errors from the backend (422). */
  fieldErrors?: Record<string, string>
}

/** Controlled form that records a purchase or sale. */
export function TransactionForm({ onSubmit, fieldErrors = {} }: TransactionFormProps) {
  const [ticker, setTicker] = useState('')
  const [broker, setBroker] = useState('IBKR')
  const [category, setCategory] = useState('Stock')
  const [operationType, setOperationType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue)
  const [submitting, setSubmitting] = useState(false)
  const [fetchingPrice, setFetchingPrice] = useState(false)

  async function handleFetchQuote(targetTicker?: string) {
    const symbol = (targetTicker ?? ticker).trim().toUpperCase()
    if (!symbol) return

    setFetchingPrice(true)
    try {
      const analysis = await marketApi.getAnalysis(symbol, '1mo')
      if (analysis && analysis.current_price) {
        setUnitPrice(analysis.current_price)
      }
    } catch {
      // Allow manual entry on provider failure
    } finally {
      setFetchingPrice(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const payload: TransactionRequest = {
      ticker: ticker.trim().toUpperCase(),
      broker: broker.trim(),
      category: category.trim(),
      operation_type: operationType,
      quantity,
      unit_price: unitPrice,
      currency: currency.trim().toUpperCase(),
      occurred_at: occurredAt,
    }

    setSubmitting(true)
    const accepted = await onSubmit(payload)
    setSubmitting(false)

    if (accepted) {
      setTicker('')
      setQuantity('')
      setUnitPrice('')
      setOccurredAt(localDateTimeValue())
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Record operation" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <TextField
            id="transaction-ticker"
            label="Ticker"
            value={ticker}
            onChange={(val) => {
              setTicker(val)
            }}
            onBlur={() => handleFetchQuote(ticker)}
            error={fieldErrors.ticker}
          />
        </div>
        <TextField
          id="transaction-broker"
          label="Broker"
          value={broker}
          onChange={setBroker}
          error={fieldErrors.broker}
        />
        <TextField
          id="transaction-category"
          label="Category"
          value={category}
          onChange={setCategory}
          error={fieldErrors.category}
        />
        <SelectField
          id="transaction-operation"
          label="Operation"
          value={operationType}
          options={OPERATION_OPTIONS}
          onChange={(value) => setOperationType(value === 'SELL' ? 'SELL' : 'BUY')}
          error={fieldErrors.operation_type}
        />
        <TextField
          id="transaction-quantity"
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          inputMode="decimal"
          error={fieldErrors.quantity}
        />
        <div className="relative">
          <TextField
            id="transaction-unit-price"
            label="Unit price"
            value={unitPrice}
            onChange={setUnitPrice}
            inputMode="decimal"
            error={fieldErrors.unit_price}
          />
          <button
            type="button"
            onClick={() => handleFetchQuote()}
            disabled={fetchingPrice || !ticker.trim()}
            className="absolute top-0 right-0 text-[10px] font-mono text-[#4cd7f6] hover:underline disabled:opacity-40 uppercase"
          >
            {fetchingPrice ? 'Buscando…' : 'Cotización'}
          </button>
        </div>
        <TextField
          id="transaction-currency"
          label="Currency"
          value={currency}
          onChange={setCurrency}
          error={fieldErrors.currency}
        />
        <TextField
          id="transaction-occurred-at"
          label="Occurred at"
          type="datetime-local"
          value={occurredAt}
          onChange={setOccurredAt}
          error={fieldErrors.occurred_at}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[#06b6d4] px-5 py-2.5 text-sm font-semibold text-[#003640] hover:bg-[#4cd7f6] transition-all disabled:opacity-50 shadow-md"
      >
        {submitting ? 'Recording…' : 'Record operation'}
      </button>
    </form>
  )
}
