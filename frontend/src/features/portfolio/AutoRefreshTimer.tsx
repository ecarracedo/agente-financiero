/**
 * Countdown that mirrors the portfolio quote refresh cycle.
 *
 * It owns both halves of the cycle: it renders the remaining time and calls
 * `onElapsed` once per full interval. Remounting it with a new `key` restarts
 * the countdown, which is how a settings change or a manual refresh resets it
 * without an effect that writes state on mount.
 */

import { useEffect, useRef, useState } from 'react'

export interface AutoRefreshTimerProps {
  /** Interval length in minutes. */
  minutes: number
  /** Called once each time a full interval elapses. */
  onElapsed: () => void
}

/** Render the remaining time until the next automatic refresh. */
export function AutoRefreshTimer({ minutes, onElapsed }: AutoRefreshTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const onElapsedRef = useRef(onElapsed)

  useEffect(() => {
    onElapsedRef.current = onElapsed
  }, [onElapsed])

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const totalSeconds = minutes * 60
  const cycle = Math.floor(elapsedSeconds / totalSeconds)
  const remainingSeconds = totalSeconds - (elapsedSeconds % totalSeconds)

  useEffect(() => {
    if (cycle === 0) return
    onElapsedRef.current()
  }, [cycle])

  const minutesPart = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const secondsPart = String(remainingSeconds % 60).padStart(2, '0')

  return (
    <time className="font-mono text-[11px] text-[#4cd7f6]">
      {minutesPart}:{secondsPart}
    </time>
  )
}
