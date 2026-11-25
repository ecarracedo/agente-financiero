/**
 * Pure display helpers shared by the alert center components.
 */

import type { ConfiguredAlert } from './alertApi'
import { ALERT_INTENTS } from './alertApi'

/** Identify one configured alert across both scopes. */
export function alertKey(alert: ConfiguredAlert): string {
  return `${alert.scope}:${alert.ticker}:${alert.broker ?? ''}:${alert.category ?? ''}`
}

/** Describe where a configured alert came from. */
export function alertOrigin(alert: ConfiguredAlert): string {
  if (alert.scope === 'wishlist') return 'Wishlist'
  return [alert.broker, alert.category].filter(Boolean).join(' · ')
}

/** Display label for a stored trade direction. */
export function intentLabel(intent: ConfiguredAlert['intent']): string {
  return ALERT_INTENTS.find((option) => option.value === intent)?.label ?? intent
}
