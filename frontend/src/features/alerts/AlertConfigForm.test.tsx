import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AlertConfigForm } from './AlertConfigForm'

describe('AlertConfigForm', () => {
  it('offers all four alert intents', () => {
    render(
      <AlertConfigForm
        intent="NEUTRAL"
        targetPrice=""
        submitting={false}
        onIntentChange={vi.fn()}
        onTargetPriceChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Neutral', 'Stop-loss', 'Buy', 'Sell'])
  })

  it('reports the selected intent and target price', () => {
    const onIntentChange = vi.fn()
    const onTargetPriceChange = vi.fn()

    render(
      <AlertConfigForm
        intent="NEUTRAL"
        targetPrice=""
        submitting={false}
        onIntentChange={onIntentChange}
        onTargetPriceChange={onTargetPriceChange}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Intent'), { target: { value: 'BUY' } })
    fireEvent.change(screen.getByLabelText('Target price'), { target: { value: '200.00' } })

    expect(onIntentChange).toHaveBeenCalledWith('BUY')
    expect(onTargetPriceChange).toHaveBeenCalledWith('200.00')
  })
})
