import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CurrencyAmount, NOT_AVAILABLE } from './CurrencyAmount'

/**
 * Contract for financial value rendering.
 *
 * The spec requires monetary values to identify their currency, and a gain and a
 * loss to be distinguishable by more than colour: each carries a sign and a cue
 * that survives greyscale.
 *
 * The backend serializes money without a leading plus (`format_money` returns
 * `"2.5"` for `Decimal("2.5")`), so a gain arrives unsigned and the direction has
 * to be derived here. A negative amount keeps its own minus sign from the
 * backend.
 */
describe('CurrencyAmount', () => {
  it('shows the amount with its currency', () => {
    render(<CurrencyAmount amount="1900.00" currency="USD" />)

    expect(screen.getByText(/1\.900,00/)).toHaveTextContent('$ 1.900,00 USD')
  })

  it('shows the unavailable label when the amount is null', () => {
    render(<CurrencyAmount amount={null} currency="USD" />)

    expect(screen.getByText(NOT_AVAILABLE)).toBeInTheDocument()
  })

  describe('a gain and a loss are distinguishable without colour', () => {
    it('marks a gain with a positive sign and a directional cue', () => {
      render(<CurrencyAmount amount="497.50" currency="USD" variant="gain-loss" />)

      const rendered = screen.getByText(/497,50/)
      expect(rendered).toHaveTextContent('+ 497,50 USD')

      // The non-colour cue has to be present in the markup, not only in a class.
      expect(rendered).toHaveAttribute('data-trend', 'up')
    })

    it('marks a loss with a negative sign and a directional cue', () => {
      render(<CurrencyAmount amount="-10.00" currency="USD" variant="gain-loss" />)

      const rendered = screen.getByText(/10,00/)
      expect(rendered).toHaveTextContent('- 10,00 USD')
      expect(rendered).toHaveAttribute('data-trend', 'down')
    })

    it('tells a gain and a loss apart by more than their colour', () => {
      const { container: gain } = render(
        <CurrencyAmount amount="497.50" currency="USD" variant="gain-loss" />,
      )
      const { container: loss } = render(
        <CurrencyAmount amount="-10.00" currency="USD" variant="gain-loss" />,
      )

      const gainTrend = gain.querySelector('[data-trend]')?.getAttribute('data-trend')
      const lossTrend = loss.querySelector('[data-trend]')?.getAttribute('data-trend')

      // Both the sign and the trend differ, so stripping colour leaves the two
      // still distinguishable.
      expect(gainTrend).not.toBe(lossTrend)
      expect(gain.textContent).toContain('+ 497,50')
      expect(loss.textContent).toContain('- 10,00')
    })

    it('does not add a sign to a plain amount that is not a gain or a loss', () => {
      render(<CurrencyAmount amount="1900.00" currency="USD" />)

      expect(screen.getByText(/1\.900,00/)).not.toHaveTextContent('+ 1.900,00')
    })

    it('treats a zero gain or loss as neither up nor down', () => {
      render(<CurrencyAmount amount="0" currency="USD" variant="gain-loss" />)

      // Zero is not a gain, so it must not claim a direction it does not have.
      expect(document.querySelector('[data-trend="up"]')).toBeNull()
      expect(document.querySelector('[data-trend="down"]')).toBeNull()
    })
  })
})
