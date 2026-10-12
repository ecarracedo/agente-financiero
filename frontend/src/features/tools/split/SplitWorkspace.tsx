/**
 * Split calculator: request a forward or reverse split projection.
 *
 * The projection is delegated entirely to the backend: the form only encodes
 * the direction and ratio into `new_shares`/`old_shares` and displays the
 * canonical `quantity`, `average_price`, and `ratio` strings it returns.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'

import { describeApiError } from '../../../api/errors'
import { ErrorState } from '../../../components/AsyncStates'
import type { SelectOption } from '../../../components/FormControls'
import { SelectField, TextField } from '../../../components/FormControls'
import type { SplitProjection } from './splitApi'
import { splitApi } from './splitApi'

type SplitDirection = 'forward' | 'reverse'

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
]

/**
 * Encode a direction and integer ratio into the API's share counts.
 *
 * @param direction Forward keeps the ratio as new shares; reverse as old shares.
 * @param ratioText Raw ratio input; a non-numeric value becomes 0 so the backend
 *   rejects it with 422 instead of the client guessing.
 */
function toShareCounts(
  direction: SplitDirection,
  ratioText: string,
): { new_shares: number; old_shares: number } {
  const parsed = Number.parseInt(ratioText.trim(), 10)
  const ratio = Number.isFinite(parsed) ? parsed : 0
  return direction === 'forward'
    ? { new_shares: ratio, old_shares: 1 }
    : { new_shares: 1, old_shares: ratio }
}

/** Render the split inputs, request the projection, and show its results. */
export function SplitWorkspace() {
  const [quantity, setQuantity] = useState('')
  const [averagePrice, setAveragePrice] = useState('')
  const [direction, setDirection] = useState<SplitDirection>('forward')
  const [ratio, setRatio] = useState('')
  const [result, setResult] = useState<SplitProjection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setSubmitting(true)
    try {
      const projection = await splitApi.calculate({
        quantity,
        average_price: averagePrice,
        ...toShareCounts(direction, ratio),
      })
      setResult(projection)
    } catch (caught) {
      setError(describeApiError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="split-heading">
      <h2 id="split-heading">Split calculator</h2>

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          id="split-quantity"
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          inputMode="decimal"
        />
        <TextField
          id="split-average-price"
          label="Average price"
          value={averagePrice}
          onChange={setAveragePrice}
          inputMode="decimal"
        />
        <SelectField
          id="split-direction"
          label="Direction"
          value={direction}
          options={DIRECTION_OPTIONS}
          onChange={(value) => setDirection(value === 'reverse' ? 'reverse' : 'forward')}
        />
        <TextField
          id="split-ratio"
          label="Ratio"
          value={ratio}
          onChange={setRatio}
          inputMode="numeric"
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Calculating…' : 'Calculate split'}
        </button>
      </form>

      {error ? <ErrorState message={error} /> : null}

      {result ? (
        <section aria-labelledby="split-result-heading">
          <h3 id="split-result-heading">Result</h3>
          <dl>
            <dt>Quantity</dt>
            <dd>{result.quantity}</dd>
            <dt>Average price</dt>
            <dd>{result.average_price}</dd>
            <dt>Ratio</dt>
            <dd>{result.ratio}</dd>
          </dl>
        </section>
      ) : null}
    </section>
  )
}
