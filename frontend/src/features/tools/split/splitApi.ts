/**
 * Split boundary for the split calculator feature.
 *
 * The frontend never re-implements split projections: it forwards the raw
 * inputs and displays whatever canonical strings the backend returns.
 */

import { request } from '../../../api/http'
import type { components } from '../../../api/types'

/** Body accepted by `POST /api/v1/splits`. */
export type SplitRequest = components['schemas']['SplitProjectionRequest']

/** Canonical split projection returned by `POST /api/v1/splits`. */
export type SplitProjection = components['schemas']['SplitProjectionResponse']

/** Typed split operations used by the split calculator. */
export const splitApi = {
  /** Request a forward or reverse split projection from the backend. */
  calculate: (body: SplitRequest): Promise<SplitProjection> =>
    request<SplitProjection>('/api/v1/splits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
}
