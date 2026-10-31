import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/http'
import { WishlistWorkspace } from './WishlistWorkspace'
import { wishlistApi } from './wishlistApi'

vi.mock('./wishlistApi', () => ({
  wishlistApi: {
    list: vi.fn(),
    add: vi.fn(),
    setTarget: vi.fn(),
    remove: vi.fn(),
  },
}))

describe('WishlistWorkspace', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('lists entries with their canonical target price or a no-target label', async () => {
    vi.mocked(wishlistApi.list).mockResolvedValue([
      { ticker: 'AAPL', target_price: '140.00' },
      { ticker: 'MSFT', target_price: null },
    ])

    render(<WishlistWorkspace />)

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('MSFT')).toBeInTheDocument()
    expect(screen.getByText('140.00')).toBeInTheDocument()
    expect(screen.getByText('No target')).toBeInTheDocument()
  })

  it('adds a ticker and refreshes the list', async () => {
    vi.mocked(wishlistApi.list)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ticker: 'NVDA', target_price: null }])
    vi.mocked(wishlistApi.add).mockResolvedValue({ ticker: 'NVDA', target_price: null })

    render(<WishlistWorkspace />)

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'NVDA' } })
    fireEvent.click(screen.getByRole('button', { name: /add ticker/i }))

    await waitFor(() => expect(wishlistApi.add).toHaveBeenCalledWith('NVDA'))
    expect(await screen.findByText('NVDA')).toBeInTheDocument()
    expect(wishlistApi.list).toHaveBeenCalledTimes(2)
  })

  it('sets a target price as a canonical string and refreshes the list', async () => {
    vi.mocked(wishlistApi.list)
      .mockResolvedValueOnce([{ ticker: 'AAPL', target_price: null }])
      .mockResolvedValueOnce([{ ticker: 'AAPL', target_price: '150.00' }])
    vi.mocked(wishlistApi.setTarget).mockResolvedValue({ updated: true })

    render(<WishlistWorkspace />)

    await screen.findByText('AAPL')
    fireEvent.change(screen.getByLabelText('Target price for AAPL'), {
      target: { value: '150.00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save target for aapl/i }))

    await waitFor(() => expect(wishlistApi.setTarget).toHaveBeenCalledWith('AAPL', '150.00'))
    expect(await screen.findByText('150.00')).toBeInTheDocument()
  })

  it('clears a target price by sending null', async () => {
    vi.mocked(wishlistApi.list)
      .mockResolvedValueOnce([{ ticker: 'AAPL', target_price: '140.00' }])
      .mockResolvedValueOnce([{ ticker: 'AAPL', target_price: null }])
    vi.mocked(wishlistApi.setTarget).mockResolvedValue({ updated: true })

    render(<WishlistWorkspace />)

    await screen.findByText('140.00')
    fireEvent.click(screen.getByRole('button', { name: /clear target for aapl/i }))

    await waitFor(() => expect(wishlistApi.setTarget).toHaveBeenCalledWith('AAPL', null))
    expect(await screen.findByText('No target')).toBeInTheDocument()
  })

  it('removes an entry and refreshes the list', async () => {
    vi.mocked(wishlistApi.list)
      .mockResolvedValueOnce([{ ticker: 'AAPL', target_price: null }])
      .mockResolvedValueOnce([])
    vi.mocked(wishlistApi.remove).mockResolvedValue({ deleted: true })

    render(<WishlistWorkspace />)

    await screen.findByText('AAPL')
    fireEvent.click(screen.getByRole('button', { name: /remove aapl/i }))

    await waitFor(() => expect(wishlistApi.remove).toHaveBeenCalledWith('AAPL'))
    await waitFor(() => expect(screen.queryByText('AAPL')).not.toBeInTheDocument())
  })

  it('surfaces a duplicate ticker (409) as an error, never as success', async () => {
    vi.mocked(wishlistApi.list).mockResolvedValue([])
    vi.mocked(wishlistApi.add).mockRejectedValue(new ApiError(409, 'duplicate ticker'))

    render(<WishlistWorkspace />)

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'AAPL' } })
    fireEvent.click(screen.getByRole('button', { name: /add ticker/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/409/)
    expect(screen.queryByText(/added/i)).not.toBeInTheDocument()
  })

  it('surfaces a missing item (404) when a target cannot be updated', async () => {
    vi.mocked(wishlistApi.list).mockResolvedValue([{ ticker: 'AAPL', target_price: null }])
    vi.mocked(wishlistApi.setTarget).mockRejectedValue(new ApiError(404, 'not found'))

    render(<WishlistWorkspace />)

    await screen.findByText('AAPL')
    fireEvent.change(screen.getByLabelText('Target price for AAPL'), {
      target: { value: '10.00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save target for aapl/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/404/)
  })

  it('surfaces a missing item (404) when a removal cannot be completed', async () => {
    vi.mocked(wishlistApi.list).mockResolvedValue([{ ticker: 'AAPL', target_price: null }])
    vi.mocked(wishlistApi.remove).mockRejectedValue(new ApiError(404, 'not found'))

    render(<WishlistWorkspace />)

    await screen.findByText('AAPL')
    fireEvent.click(screen.getByRole('button', { name: /remove aapl/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/404/)
  })
})
