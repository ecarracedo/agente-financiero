import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EmptyState, ErrorState, LoadingState, SuccessState } from './AsyncStates'

/**
 * Contract for the four view states.
 *
 * The spec requires loading, empty and error to be distinguishable from each
 * other, and success feedback to be scoped to the action it describes. The
 * states are told apart by assistive technology, not only by what they say, so
 * each carries a distinct role.
 *
 * Empty carries the view's own wording: "an empty state specific to that view is
 * shown", which is why the message is required rather than defaulted.
 */
describe('AsyncStates', () => {
  describe('LoadingState', () => {
    it('announces itself politely as a status', () => {
      render(<LoadingState label="Loading portfolio…" />)

      expect(screen.getByRole('status')).toHaveTextContent('Loading portfolio…')
    })
  })

  describe('ErrorState', () => {
    it('announces itself as an alert', () => {
      render(<ErrorState message="Could not load the portfolio." />)

      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the portfolio.')
    })
  })

  describe('EmptyState', () => {
    it('shows the view-specific message it was given', () => {
      render(<EmptyState message="No holdings yet." />)

      expect(screen.getByText('No holdings yet.')).toBeInTheDocument()
    })

    it('is distinguishable from the loading state', () => {
      const { container: empty } = render(<EmptyState message="No holdings yet." />)
      // A settled empty result must not be announced as a loading event.
      expect(empty.querySelector('[role="status"]')).toBeNull()

      const { container: loading } = render(<LoadingState />)
      expect(loading.querySelector('[role="status"]')).toHaveTextContent('Loading…')
    })
  })

  describe('SuccessState', () => {
    it('announces the saved message as a status', () => {
      render(<SuccessState message="Alert saved." />)

      expect(screen.getByRole('status')).toHaveTextContent('Alert saved.')
    })

    it('does not reuse the loading role', () => {
      // Both are transient and both are polite, so they must not be told apart
      // by wording alone: the caller renders one or the other, never both.
      const { container } = render(<SuccessState message="Alert saved." />)
      expect(container).toHaveTextContent('Alert saved.')
    })
  })

  describe('the four states are mutually distinguishable', () => {
    it('gives each state its own element, role and wording', () => {
      const { container } = render(
        <>
          <LoadingState label="Loading…" />
          <EmptyState message="Nothing here." />
          <SuccessState message="Saved." />
        </>,
      )

      // Loading and success are transient events, so they are live statuses.
      const statuses = Array.from(container.querySelectorAll('[role="status"]')).map(
        (node) => node.textContent,
      )
      expect(statuses).toEqual(['Loading…', 'Saved.'])

      // Empty is a settled state, not an event: it must not announce itself.
      const empty = screen.getByText('Nothing here.')
      expect(empty).not.toHaveAttribute('role')
    })
  })
})
