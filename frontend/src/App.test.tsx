import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { api } from './api/client'

vi.mock('./api/client', () => ({
  api: {
    health: vi.fn(),
    ready: vi.fn(),
  },
}))

describe('App', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the application shell heading', () => {
    vi.mocked(api.ready).mockResolvedValue({ status: 'ready' })

    render(<App />)

    expect(screen.getByRole('heading', { name: /financial agent/i })).toBeInTheDocument()
  })

  it('shows the readiness reported by the client', async () => {
    vi.mocked(api.ready).mockResolvedValue({ status: 'ready' })

    render(<App />)

    expect(await screen.findByText(/backend: ready/i)).toBeInTheDocument()
  })

  it('renders without a real backend when the client request fails', async () => {
    vi.mocked(api.ready).mockRejectedValue(new Error('network down'))

    render(<App />)

    expect(await screen.findByText(/backend: unavailable/i)).toBeInTheDocument()
  })
})
