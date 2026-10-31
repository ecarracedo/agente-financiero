import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Card } from './Card'

/**
 * Compatibility probe for the vendored Tremor Raw components under React 19.
 *
 * The vendored Card uses `React.forwardRef` and `React.ComponentPropsWithoutRef`,
 * both of which are deprecated-adjacent but stable in React 19. This test proves
 * the component mounts, forwards its ref, and applies its Tailwind classes, so
 * the rest of the redesign can proceed on a verified base.
 */
describe('Tremor Card (vendored)', () => {
  it('renders its content', () => {
    render(<Card>Portfolio summary</Card>)

    expect(screen.getByText('Portfolio summary')).toBeInTheDocument()
  })

  it('applies the Tremor base classes so Tailwind has something to style', () => {
    render(<Card data-testid="card">Body</Card>)

    const card = screen.getByTestId('card')
    expect(card.className).toContain('rounded-lg')
    expect(card.className).toContain('border')
    expect(card.getAttribute('tremor-id')).toBe('tremor-raw')
  })

  it('merges a consumer className instead of dropping it', () => {
    render(
      <Card data-testid="card" className="grid gap-4">
        Body
      </Card>,
    )

    const card = screen.getByTestId('card')
    expect(card.className).toContain('grid')
    expect(card.className).toContain('gap-4')
    expect(card.className).toContain('rounded-lg')
  })

  it('forwards a ref to the underlying element under React 19', () => {
    const ref = { current: null as HTMLDivElement | null }
    render(<Card ref={ref}>Body</Card>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.textContent).toBe('Body')
  })
})
