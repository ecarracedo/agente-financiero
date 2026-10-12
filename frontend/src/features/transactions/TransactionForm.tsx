/**
 * Buy/sell operation form.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import type { TransactionRequest } from '../../api/client'
import type { SelectOption } from '../../components/FormControls'
import { SelectField, TextField } from '../../components/FormControls'

const OPERATION_OPTIONS: SelectOption[] = [
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
]

export interface TransactionFormProps {
  /** Submit handler; resolves `true` when the operation was accepted. */
  onSubmit: (payload: TransactionRequest) => Promise<boolean>
}

/** Controlled form that records a purchase or sale. */
export function TransactionForm({ onSubmit }: TransactionFormProps) {
  const [ticker, setTicker] = useState('')
  const [broker, setBroker] = useState('')
  const [category, setCategory] = useState('')
  const [operationType, setOperationType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [currency, setCurrency] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const payload: TransactionRequest = {
      ticker: ticker.trim(),
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
      setBroker('')
      setCategory('')
      setQuantity('')
      setUnitPrice('')
      setCurrency('')
      setOccurredAt('')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <TextField id="transaction-ticker" label="Ticker" value={ticker} onChange={setTicker} />
      <TextField id="transaction-broker" label="Broker" value={broker} onChange={setBroker} />
      <TextField
        id="transaction-category"
        label="Category"
        value={category}
        onChange={setCategory}
      />
      <SelectField
        id="transaction-operation"
        label="Operation"
        value={operationType}
        options={OPERATION_OPTIONS}
        onChange={(value) => setOperationType(value === 'SELL' ? 'SELL' : 'BUY')}
      />
      <TextField
        id="transaction-quantity"
        label="Quantity"
        value={quantity}
        onChange={setQuantity}
        inputMode="decimal"
      />
      <TextField
        id="transaction-unit-price"
        label="Unit price"
        value={unitPrice}
        onChange={setUnitPrice}
        inputMode="decimal"
      />
      <TextField
        id="transaction-currency"
        label="Currency"
        value={currency}
        onChange={setCurrency}
      />
      <TextField
        id="transaction-occurred-at"
        label="Occurred at"
        type="datetime-local"
        value={occurredAt}
        onChange={setOccurredAt}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Recording…' : 'Record operation'}
      </button>
    </form>
  )
}
