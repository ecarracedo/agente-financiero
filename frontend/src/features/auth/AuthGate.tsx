/**
 * Gate that keeps every workspace behind a session.
 *
 * On mount it asks the backend who is signed in (`/auth/me`). A 401 shows
 * the login page; any other outcome (including a backend outage) keeps the
 * workspaces visible so existing error states stay reachable.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { authApi } from './authApi'
import { LoginPage } from './LoginPage'

type GateState = 'checking' | 'authenticated' | 'anonymous'

/** Render children only with a valid session, otherwise the login page. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking')

  useEffect(() => {
    let active = true
    authApi
      .me()
      .then(() => {
        if (active) setState('authenticated')
      })
      .catch((error: unknown) => {
        if (!active) return
        const status =
          error !== null && typeof error === 'object' && 'status' in error
            ? (error as { status: number }).status
            : null
        setState(status === 401 ? 'anonymous' : 'authenticated')
      })
    return () => {
      active = false
    }
  }, [])

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f131c]">
        <p className="text-sm text-[#869397]">Verificando acceso…</p>
      </div>
    )
  }

  if (state === 'anonymous') {
    return <LoginPage onAuthenticated={() => setState('authenticated')} />
  }

  return <>{children}</>
}
