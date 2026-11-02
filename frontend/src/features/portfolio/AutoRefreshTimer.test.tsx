import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AutoRefreshTimer } from './AutoRefreshTimer'

/**
 * Countdown behavior under fake timers.
 *
 * The component owns the whole cycle, so this is where the interval contract is
 * provable: the portfolio table only remounts it with a new `key`, and a timer
 * that drifted or fired twice would silently multiply quote requests.
 */
describe('AutoRefreshTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down to zero and starts the next cycle', () => {
    render(<AutoRefreshTimer minutes={1} onElapsed={() => {}} />)

    expect(screen.getByText('01:00')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('00:59')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(screen.getByText('01:00')).toBeInTheDocument()
  })

  it('calls onElapsed once per full interval, not once per second', () => {
    const onElapsed = vi.fn()
    render(<AutoRefreshTimer minutes={1} onElapsed={onElapsed} />)

    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(onElapsed).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onElapsed).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onElapsed).toHaveBeenCalledTimes(2)
  })

  it('follows the configured interval length', () => {
    const onElapsed = vi.fn()
    render(<AutoRefreshTimer minutes={5} onElapsed={onElapsed} />)

    expect(screen.getByText('05:00')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(299_000)
    })
    expect(onElapsed).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onElapsed).toHaveBeenCalledTimes(1)
  })
})
