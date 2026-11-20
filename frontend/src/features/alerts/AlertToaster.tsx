/**
 * Global alert popup mounted once by the application shell.
 *
 * It polls the persisted crossing feed and turns only *new* ids into toasts;
 * crossings that already existed when the app opened are seeded as seen so a
 * page load never replays history. Dismissing a toast is a local UI action and
 * deliberately does not acknowledge the event, which stays an explicit action
 * in the alerts workspace.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { alertApi } from './alertApi'
import type { TriggeredAlertEvent } from './alertApi'
import { playAlertSound, unlockAlertSound } from './alertSound'
import {
  DEFAULT_ALERT_SOUND,
  readAlertSound,
  subscribeAlertSound,
} from './alertSoundSettings'

/** Default delay between crossing-feed polls. */
const DEFAULT_POLL_INTERVAL_MS = 15_000

export interface AlertToasterProps {
  /** Poll delay; overridable so tests can drive several rounds quickly. */
  pollIntervalMs?: number
  /** Sound callback; injectable so tests can assert without WebAudio. */
  onSound?: () => void
}

/** Format a canonical amount using the global '$ 1.000,00 CODE' shape. */
function formatMoney(amount: string, currency: string | null): string {
  const numeric = Number(amount)
  const formatted = Number.isFinite(numeric)
    ? numeric.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : amount
  return currency ? `$ ${formatted} ${currency}` : `$ ${formatted}`
}

/**
 * Poll the crossing feed and show a transient popup for each new event.
 */
export function AlertToaster({
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onSound = playAlertSound,
}: AlertToasterProps) {
  const soundEnabled = useSyncExternalStore(
    subscribeAlertSound,
    readAlertSound,
    () => DEFAULT_ALERT_SOUND,
  )
  const [toasts, setToasts] = useState<TriggeredAlertEvent[]>([])
  /** `null` until the first successful load seeds the pre-existing ids. */
  const seenIds = useRef<Set<number> | null>(null)
  const inFlight = useRef(false)
  const soundEnabledRef = useRef(soundEnabled)
  const onSoundRef = useRef(onSound)

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    onSoundRef.current = onSound
  }, [onSound])

  // Browsers require a gesture before audio can play; the first click anywhere
  // unlocks the shared context, and a blocked context simply leaves us silent.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAlertSound, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAlertSound)
  }, [])

  useEffect(() => {
    let active = true

    async function poll() {
      if (inFlight.current) return
      inFlight.current = true
      try {
        const events = await alertApi.listEvents()
        if (!active) return
        if (seenIds.current === null) {
          seenIds.current = new Set(events.map((event) => event.id))
          return
        }
        const fresh = events.filter((event) => !seenIds.current!.has(event.id))
        if (fresh.length === 0) return
        fresh.forEach((event) => seenIds.current!.add(event.id))
        setToasts((previous) => [
          ...previous,
          ...fresh.filter((event) => !previous.some((item) => item.id === event.id)),
        ])
        if (soundEnabledRef.current) onSoundRef.current()
      } catch {
        // A transient API failure must not stop the next poll.
      } finally {
        inFlight.current = false
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), pollIntervalMs)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [pollIntervalMs])

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notificaciones de alertas"
      className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 w-[min(360px,calc(100vw-3rem))]"
    >
      {toasts.map((event) => (
        <div
          key={event.id}
          role="status"
          className="bg-[#181c24]/80 backdrop-blur-md rounded-xl p-4 shadow-md flex flex-col gap-2 border border-[#3d494c]/20"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[20px] text-[#4cd7f6]"
            >
              notifications_active
            </span>
            <span className="text-[10px] font-mono uppercase text-[#869397]">
              {event.scope}
            </span>
            <button
              type="button"
              aria-label="Cerrar alerta"
              onClick={() =>
                setToasts((previous) => previous.filter((item) => item.id !== event.id))
              }
              className="text-[#869397] hover:text-white transition-colors"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                close
              </span>
            </button>
          </div>
          <span className="text-base font-semibold font-headline text-white">
            {event.ticker}
          </span>
          <span className="text-xs font-mono text-[#dfe2ee]">{event.message}</span>
          <span className="text-[10px] font-mono text-[#869397]">
            {formatMoney(event.target_price, event.currency)} →{' '}
            {formatMoney(event.observed_price, event.currency)}
          </span>
        </div>
      ))}
    </div>
  )
}
