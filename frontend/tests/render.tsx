import { render as rtlRender } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { appRoutes } from '../src/app/routes'

/**
 * Shared render helper for tests.
 *
 * Builds the same route tree the application uses, with a memory router, so a
 * test exercises real navigation and real route wiring instead of hand-mocking
 * the shell. `initialEntries` opens a workspace by URL, which is how the
 * deep-link tests work.
 */
export function renderWithRouter(
  _element: null,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  const router = createMemoryRouter(appRoutes, { initialEntries })
  return rtlRender(<RouterProvider router={router} />)
}
