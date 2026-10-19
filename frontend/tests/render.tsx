import { render as rtlRender } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ReactElement } from 'react'

/**
 * Shared render helper for tests.
 * Wraps a component with a MemoryRouter, mirroring the app's routing setup.
 */
export function renderWithRouter(
  element: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  const router = createMemoryRouter(
    [{ path: '*', element }],
    { initialEntries },
  )
  return rtlRender(<RouterProvider router={router} />)
}
