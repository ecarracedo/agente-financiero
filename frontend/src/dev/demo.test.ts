import { describe, expect, it } from 'vitest'

import { startDemo } from './demo'

/**
 * Demo mode gating.
 *
 * The positive path cannot run here: the browser worker needs a service worker
 * and jsdom has none. What is checked is the gate itself, which is the part that
 * keeps the fixtures out of an ordinary development session.
 */
describe('startDemo', () => {
  it('stays off when VITE_DEMO is not set', async () => {
    expect(await startDemo()).toBeUndefined()
  })
})
