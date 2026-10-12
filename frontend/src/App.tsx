import { useEffect, useState } from 'react'

import { api } from './api/client'

type BackendStatus = 'loading' | 'ready' | 'unavailable'

/**
 * Application shell.
 *
 * Renders a minimal shell and reports backend readiness through the typed
 * client. Data views for portfolio, transactions, and alerts are added on top
 * of this shell in later tasks.
 */
export function App() {
  const [status, setStatus] = useState<BackendStatus>('loading')

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
      </header>
      <p role="status">Backend: {status}</p>
    </main>
  )
}
