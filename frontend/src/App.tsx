import { useEffect, useState } from 'react'

import { api } from './api/client'
import { PortfolioWorkspace } from './features/portfolio/PortfolioWorkspace'
import { TransactionsWorkspace } from './features/transactions/TransactionsWorkspace'

type BackendStatus = 'loading' | 'ready' | 'unavailable'
type WorkspaceTab = 'portfolio' | 'transactions'

/**
 * Application shell.
 *
 * Reports backend readiness and hosts the workspace tabs. Portfolio and
 * transactions are implemented here; charts, alerts, wishlist, bibliography,
 * and split tools plug into the same shell in later tasks.
 */
export function App() {
  const [status, setStatus] = useState<BackendStatus>('loading')
  const [tab, setTab] = useState<WorkspaceTab>('portfolio')
  const [portfolioVersion, setPortfolioVersion] = useState(0)

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
        <button
          type="button"
          aria-pressed={tab === 'portfolio'}
          onClick={() => setTab('portfolio')}
        >
          Portfolio
        </button>
        <button
          type="button"
          aria-pressed={tab === 'transactions'}
          onClick={() => setTab('transactions')}
        >
          Transactions
        </button>
      </nav>
      {tab === 'portfolio' ? (
        <PortfolioWorkspace refreshToken={portfolioVersion} />
      ) : (
        <TransactionsWorkspace
          onPortfolioChanged={() => setPortfolioVersion((version) => version + 1)}
        />
      )}
    </main>
  )
}
