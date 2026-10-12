import { useEffect, useState } from 'react'

import { api } from './api/client'
import { BibliographyWorkspace } from './features/bibliography/BibliographyWorkspace'
import { MarketWorkspace } from './features/market/MarketWorkspace'
import { PortfolioWorkspace } from './features/portfolio/PortfolioWorkspace'
import { SplitWorkspace } from './features/tools/split/SplitWorkspace'
import { TransactionsWorkspace } from './features/transactions/TransactionsWorkspace'
import { WishlistWorkspace } from './features/wishlist/WishlistWorkspace'

type BackendStatus = 'loading' | 'ready' | 'unavailable'
type WorkspaceTab =
  | 'portfolio'
  | 'transactions'
  | 'market'
  | 'wishlist'
  | 'bibliography'
  | 'tools'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'market', label: 'Market' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'bibliography', label: 'Bibliography' },
  { id: 'tools', label: 'Tools' },
]

/**
 * Application shell.
 *
 * Reports backend readiness and hosts the workspace tabs. Portfolio,
 * transactions, market, wishlist, bibliography, and the split calculator are
 * all rendered here from the same shell.
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

  function renderWorkspace() {
    switch (tab) {
      case 'portfolio':
        return <PortfolioWorkspace refreshToken={portfolioVersion} />
      case 'transactions':
        return (
          <TransactionsWorkspace
            onPortfolioChanged={() => setPortfolioVersion((version) => version + 1)}
          />
        )
      case 'market':
        return <MarketWorkspace />
      case 'wishlist':
        return <WishlistWorkspace />
      case 'bibliography':
        return <BibliographyWorkspace />
      case 'tools':
        return <SplitWorkspace />
    }
  }

  return (
    <main>
      <header>
        <h1>Financial Agent</h1>
        <p role="status">Backend: {status}</p>
      </header>
      <nav aria-label="Workspaces">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tab === entry.id}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      {renderWorkspace()}
    </main>
  )
}
