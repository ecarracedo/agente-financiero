import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithRouter } from '../../tests/render'

/**
 * Route-level behavior for the workspace shell.
 *
 * These tests exercise the real route tree the application uses, through the
 * shared `renderWithRouter` helper, so a deep link and a navigation round-trip
 * are checked against the actual wiring instead of a hand-mocked shell.
 */
describe('workspace routes', () => {
  it('shows the default workspace at the application root', async () => {
    renderWithRouter(null, { initialEntries: ['/'] })

    expect(
      await screen.findByRole('heading', { name: 'Portfolio' }),
    ).toBeInTheDocument()
  })

  it('restores a workspace opened by its URL with no manual navigation', async () => {
    renderWithRouter(null, { initialEntries: ['/transactions'] })

    expect(
      await screen.findByRole('heading', { name: 'Transactions' }),
    ).toBeInTheDocument()
  })

  it('keeps entered form data when leaving and returning to a workspace', async () => {
    const user = userEvent.setup()
    renderWithRouter(null, { initialEntries: ['/bibliography'] })

    await screen.findByRole('heading', { name: 'Bibliography' })

    await user.type(screen.getByLabelText('Title'), 'Security Analysis')

    await user.click(screen.getByRole('link', { name: 'Portfolio' }))
    await screen.findByRole('heading', { name: 'Portfolio' })

    await user.click(screen.getByRole('link', { name: 'Bibliography' }))
    await screen.findByRole('heading', { name: 'Bibliography' })

    expect(screen.getByLabelText('Title')).toHaveValue('Security Analysis')
  })

  it('reaches alerts without opening the market workspace', async () => {
    renderWithRouter(null, { initialEntries: ['/alerts'] })

    expect(await screen.findByRole('heading', { name: 'Alerts' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Market' })).not.toBeInTheDocument()
  })
})
