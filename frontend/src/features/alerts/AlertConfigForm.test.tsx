import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AlertConfigForm } from './AlertConfigForm'

/** Render the form with a controlled spy and an optional live quote. */
function renderForm(referencePrice?: string) {
  const onIntentChange = vi.fn()
  const onTargetPriceChange = vi.fn()
  render(
    <AlertConfigForm
      intent="BUY"
      targetPrice=""
      referencePrice={referencePrice}
      submitting={false}
      onIntentChange={onIntentChange}
      onTargetPriceChange={onTargetPriceChange}
      onSubmit={vi.fn()}
    />,
  )
  return { onIntentChange, onTargetPriceChange }
}

describe('AlertConfigForm', () => {
  it('offers only the buy and sell alert types in Spanish', () => {
    renderForm()

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Compra', 'Venta'])
  })

  it('reports the selected type and target price using Spanish labels', () => {
    const { onIntentChange, onTargetPriceChange } = renderForm()

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'SELL' } })
    fireEvent.change(screen.getByLabelText('Precio objetivo'), { target: { value: '200.00' } })

    expect(onIntentChange).toHaveBeenCalledWith('SELL')
    expect(onTargetPriceChange).toHaveBeenCalledWith('200.00')
  })

  it('adds the 25%, 50% and 75% presets to the live quote', () => {
    const { onTargetPriceChange } = renderForm('100.00')

    for (const [label, expected] of [
      ['+25%', '125.00'],
      ['+50%', '150.00'],
      ['+75%', '175.00'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(onTargetPriceChange).toHaveBeenLastCalledWith(expected)
    }
  })

  it('accepts a custom percentage, including a decimal comma', () => {
    const { onTargetPriceChange } = renderForm('200.00')

    fireEvent.change(screen.getByLabelText('Porcentaje personalizado (%)'), {
      target: { value: '10' },
    })
    expect(onTargetPriceChange).toHaveBeenLastCalledWith('220.00')

    fireEvent.change(screen.getByLabelText('Porcentaje personalizado (%)'), {
      target: { value: '12,5' },
    })
    expect(onTargetPriceChange).toHaveBeenLastCalledWith('225.00')
  })

  it('clears the custom percentage when the target price is edited manually', () => {
    renderForm('100.00')

    fireEvent.change(screen.getByLabelText('Porcentaje personalizado (%)'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Precio objetivo'), { target: { value: '130.00' } })

    expect(screen.getByLabelText('Porcentaje personalizado (%)')).toHaveValue('')
  })

  it('disables percentage shortcuts when there is no live quote', () => {
    renderForm()

    expect(screen.getByRole('button', { name: '+25%' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '+50%' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '+75%' })).toBeDisabled()
    expect(screen.getByLabelText('Porcentaje personalizado (%)')).toBeDisabled()
  })
})
