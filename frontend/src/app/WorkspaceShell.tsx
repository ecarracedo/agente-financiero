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
    <main>
      <header>
        <h1>Financial Agent</h1>
        <p role="status">Backend: {status}</p>
      </header>

      <nav aria-label="Workspaces">
        {WORKSPACE_ROUTES.map((route) => (
          <NavLink
            key={route.path}
            to={`/${route.path}`}
            aria-current={activePath === route.path ? 'page' : undefined}
          >
            {route.label}
          </NavLink>
        ))}
      </nav>

      {WORKSPACE_ROUTES.map((route) => (
        <div key={route.path} hidden={route.path !== activePath}>
          {route.element}
        </div>
      ))}
    </main>
  )
}
