import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../tests/setup'
import { triggeredAlertEvents } from '../../mocks/fixtures'
import type { TriggeredAlertEvent } from './alertApi'
import { ALERT_SOUND_STORAGE_KEY } from './alertSoundSettings'
import { AlertToaster } from './AlertToaster'

/** Build a new crossing that is not part of the seeded fixture list. */
function newEvent(id: number, ticker: string): TriggeredAlertEvent {
  return {
    ...triggeredAlertEvents[0],
    id,
    ticker,
    message: `Alerta de ${ticker}.`,
    acknowledged_at: null,
  }
}

/** Serve a deterministic sequence of event batches on each poll. */
function serveBatches(batches: TriggeredAlertEvent[][], onPoll?: () => void) {
  let index = 0
  server.use(
    http.get('*/api/v1/alerts/events', () => {
      onPoll?.()
      const batch = batches[Math.min(index, batches.length - 1)]
      index += 1
      return HttpResponse.json(batch)
    }),
  )
}

describe('AlertToaster', () => {
  beforeEach(() => {
    window.localStorage.setItem(ALERT_SOUND_STORAGE_KEY, 'false')
  })

  it('seeds the seen set from the first load without popping old events', async () => {
    serveBatches([triggeredAlertEvents])

    render(<AlertToaster pollIntervalMs={20} />)

    await waitFor(() => {
      expect(screen.queryByText(/Alerta de TSLA/)).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pops a toast once per new event id', async () => {
    const seeded = triggeredAlertEvents
    const updated = [...seeded, newEvent(3, 'TSLA')]
    let polls = 0
    serveBatches([seeded, updated], () => {
      polls += 1
    })

    render(<AlertToaster pollIntervalMs={20} />)

    await waitFor(() => expect(polls).toBeGreaterThanOrEqual(2))
    expect(await screen.findByText('Alerta de TSLA.')).toBeInTheDocument()
    await waitFor(() => expect(polls).toBeGreaterThanOrEqual(4))
    expect(screen.getAllByText('Alerta de TSLA.')).toHaveLength(1)
  })

  it('plays the sound for a new event only when the preference is enabled', async () => {
    window.localStorage.setItem(ALERT_SOUND_STORAGE_KEY, 'true')
    const onSound = vi.fn()
    serveBatches([triggeredAlertEvents, [...triggeredAlertEvents, newEvent(4, 'TSLA')]])

    render(<AlertToaster pollIntervalMs={20} onSound={onSound} />)

    await waitFor(() => expect(onSound).toHaveBeenCalledTimes(1))
  })

  it('stays silent when the sound preference is disabled', async () => {
    const onSound = vi.fn()
    serveBatches([triggeredAlertEvents, [...triggeredAlertEvents, newEvent(5, 'TSLA')]])

    render(<AlertToaster pollIntervalMs={20} onSound={onSound} />)

    await waitFor(() => expect(screen.getByText('Alerta de TSLA.')).toBeInTheDocument())
    expect(onSound).not.toHaveBeenCalled()
  })

  it('closing a toast never acknowledges the event', async () => {
    const acknowledged: number[] = []
    server.use(
      http.post('*/api/v1/alerts/events/:event_id/acknowledge', ({ params }) => {
        acknowledged.push(Number(params.event_id))
        return HttpResponse.json({ acknowledged: true })
      }),
    )
    serveBatches([triggeredAlertEvents, [...triggeredAlertEvents, newEvent(6, 'TSLA')]])

    render(<AlertToaster pollIntervalMs={20} />)

    const toast = (await screen.findByText('Alerta de TSLA.')).closest('[role="status"]')
    fireEvent.click(
      (toast as HTMLElement).querySelector('button[aria-label="Cerrar alerta"]')!,
    )

    await waitFor(() => expect(screen.queryByText('Alerta de TSLA.')).not.toBeInTheDocument())
    expect(acknowledged).toEqual([])
  })

  it('keeps polling after a failed request', async () => {
    let calls = 0
    server.use(
      http.get('*/api/v1/alerts/events', () => {
        calls += 1
        if (calls === 2) return new HttpResponse(null, { status: 500 })
        return HttpResponse.json(
          calls === 1 ? triggeredAlertEvents : [...triggeredAlertEvents, newEvent(7, 'TSLA')],
        )
      }),
    )

    render(<AlertToaster pollIntervalMs={20} />)

    expect(await screen.findByText('Alerta de TSLA.')).toBeInTheDocument()
  })
})
