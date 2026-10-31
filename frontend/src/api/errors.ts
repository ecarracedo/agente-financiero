/**
 * Human-readable error mapping for the API boundary.
 */

import { ApiError } from './http'

/**
 * Turn an unknown thrown value into a user-facing message.
 *
 * @param error Value caught from a client call.
 * @returns An English message safe to render in the UI.
 */
export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      return 'Operation rejected: the backend refused the request.'
    }
    return `Backend request failed with status ${error.status}.`
  }
  return 'Unexpected error while contacting the backend.'
}
