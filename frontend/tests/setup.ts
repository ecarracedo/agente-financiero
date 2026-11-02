// Vitest setup: register jest-dom matchers and MSW lifecycle.
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from 'msw/node'

import { handlers } from '../src/mocks/handlers'

/**
 * The MSW server the suite runs against.
 *
 * Exported so a test can replace a single handler with `server.use(...)` for the
 * duration of one test, which is how a pending or failing request is reached now
 * that the views call the real client.
 */
export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  // Preferences live in `localStorage`; leaking them between tests would let one
  // test's catalog decide what another test renders.
  window.localStorage.clear()
})
afterAll(() => server.close())
