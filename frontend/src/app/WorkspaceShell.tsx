import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'

import { api } from '../api/client'
import { DEFAULT_WORKSPACE, WORKSPACE_ROUTES } from './routes'

type BackendStatus = 'loading' | 'ready' | 'unavailable'

/**
 * Application shell.
 *
 * Renders the header, the workspace navigation and every workspace. All
 * workspaces stay mounted and the inactive ones are hidden with the `hidden`
 * attribute, so data the user has entered survives navigation without a global
 * store (see the redesign design, decision D4). `hidden` also removes an
 * inactive workspace from the accessibility tree.
 *
 * Rendering every workspace up front is deliberate: it keeps the shell free of
 * mount bookkeeping and matches the state-preservation requirement directly.
 */
export function WorkspaceShell() {
  const location = useLocation()
  const [status, setStatus] = useState<BackendStatus>('loading')

  const requestedPath = location.pathname.replace(/^\//, '').split('/')[0]
  // The application root has no workspace segment; it lands on the default.
  const activePath = requestedPath === '' ? DEFAULT_WORKSPACE : requestedPath

  useEffect(() => {
    let active = true
    api
      .ready()
      .then(() => {
        if (active) setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('unavailable')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-50">
      <header className="border-b border-gray-200 bg-white dark:border-gray-900 dark:bg-[#090E1A]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <h1 className="text-lg font-semibold">Financial Agent</h1>
          <p
            role="status"
            className={
              status === 'unavailable'
                ? 'text-sm font-medium text-red-600 dark:text-red-400'
                : 'text-sm text-gray-500 dark:text-gray-400'
            }
          >
            Backend: {status}
          </p>
        </div>
        <nav aria-label="Workspaces" className="mx-auto max-w-6xl overflow-x-auto px-6">
          <ul className="flex gap-1">
            {WORKSPACE_ROUTES.map((route) => (
              <li key={route.path}>
                <NavLink
                  to={`/${route.path}`}
                  aria-current={activePath === route.path ? 'page' : undefined}
                  className="inline-block border-b-2 px-4 py-3 text-sm font-medium transition-colors aria-[current=page]:border-blue-600 aria-[current=page]:text-blue-700 dark:aria-[current=page]:border-blue-500 dark:aria-[current=page]:text-blue-400 border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  {route.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {WORKSPACE_ROUTES.map((route) => (
          <div key={route.path} hidden={route.path !== activePath}>
            {route.element}
          </div>
        ))}
      </main>
    </div>
  )
}
