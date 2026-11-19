import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AlertConfigForm } from './AlertConfigForm'

describe('AlertConfigForm', () => {
  it('offers only the buy and sell alert types', () => {
    render(
      <AlertConfigForm
        intent="BUY"
        targetPrice=""
        submitting={false}
        onIntentChange={vi.fn()}
        onTargetPriceChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Buy', 'Sell'])
  })

  it('reports the selected type and target price', () => {
    const onIntentChange = vi.fn()
    const onTargetPriceChange = vi.fn()

    render(
      <AlertConfigForm
        intent="BUY"
        targetPrice=""
        submitting={false}
        onIntentChange={onIntentChange}
        onTargetPriceChange={onTargetPriceChange}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'SELL' } })
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '200.00' } })

    expect(onIntentChange).toHaveBeenCalledWith('SELL')
    expect(onTargetPriceChange).toHaveBeenCalledWith('200.00')
  })
})
