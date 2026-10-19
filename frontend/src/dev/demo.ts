/**
 * Starts the MSW browser worker for local demo mode when VITE_DEMO=1.
 * The worker is only started in development and never in production builds.
 */

import { setupWorker } from 'msw/browser'

import { handlers } from '../mocks/handlers'

export async function startDemo() {
  if (import.meta.env.VITE_DEMO !== '1') {
    return
  }
  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledRequest: 'bypass' })
  return worker
}
