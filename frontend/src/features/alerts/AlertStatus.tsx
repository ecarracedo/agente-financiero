/**
 * Presentation of the outcome of an alert check.
 *
 * The crossing message is always the backend `event.message`; the UI never
 * re-derives or retranslates it.
 */

import { describeApiError } from '../../api/errors'
import { ErrorState, LoadingState } from '../../components/AsyncStates'
import { NOT_AVAILABLE } from '../../components/CurrencyAmount'
import type { TargetAlertEvent } from './alertApi'

/** Discriminated result of an alert check action. */
export type AlertCheckState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'no-crossing'; currentPrice: string }
  | { kind: 'crossing'; currentPrice: string; event: TargetAlertEvent }
  | { kind: 'unavailable' }
  | { kind: 'error'; error: unknown }

export interface AlertStatusProps {
  state: AlertCheckState
}

/** Render the alert check outcome, or nothing while idle. */
export function AlertStatus({ state }: AlertStatusProps) {
  if (state.kind === 'idle') {
    return null
  }
  if (state.kind === 'loading') {
    return <LoadingState label="Checking alert…" />
  }
  if (state.kind === 'crossing') {
    return <p role="status">{state.event.message}</p>
  }
  if (state.kind === 'no-crossing') {
    return <p>No crossing</p>
  }
  if (state.kind === 'unavailable') {
    return <p role="status">{NOT_AVAILABLE}</p>
  }
  return <ErrorState message={describeApiError(state.error)} />
}
