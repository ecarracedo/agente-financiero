import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { api } from './api/client'

vi.mock('./api/client', () => ({
  api: {
    health: vi.fn(),
    ready: vi.fn(),
    listPortfolio: vi.fn(),
    getValuations: vi.fn(),
    listTransactions: vi.fn(),
    createTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}))

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.ready).mockResolvedValue({ status: 'ready' })
    vi.mocked(api.listPortfolio).mockResolvedValue([])
    vi.mocked(api.getValuations).mockResolvedValue([])
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders the application shell heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /financial agent/i })).toBeInTheDocument()
  })

  it('shows the readiness reported by the client', async () => {
    render(<App />)

    expect(await screen.findByText(/backend: ready/i)).toBeInTheDocument()
  })

  it('renders without a real backend when the client request fails', async () => {
    vi.mocked(api.ready).mockRejectedValue(new Error('network down'))

    render(<App />)

    expect(await screen.findByText(/backend: unavailable/i)).toBeInTheDocument()
  })

  it('switches between the portfolio and transactions workspaces', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Portfolio' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Transactions' }))

    expect(
      await screen.findByRole('heading', { name: 'Transactions' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /record operation/i })).toBeInTheDocument()
  })
})
