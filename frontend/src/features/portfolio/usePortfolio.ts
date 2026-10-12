/**
 * Data-fetching hook for the portfolio workspace.
 */

import { useCallback, useEffect, useState } from 'react'

import type { CurrencyValuation, PortfolioPosition } from '../../api/client'
import { api } from '../../api/client'

/** Combined portfolio payload rendered by the workspace. */
export interface PortfolioData {
  positions: PortfolioPosition[]
  valuations: CurrencyValuation[]
}

export type PortfolioStatus = 'loading' | 'ready' | 'error'

interface PortfolioState {
  status: PortfolioStatus
  data: PortfolioData | null
  error: unknown
}

export interface PortfolioResult extends PortfolioState {
  reload: () => void
}

/**
 * Load positions and valuations together.
 *
 * @param refreshToken External counter: any change triggers a refetch, letting
 *   the shell re-sync holdings after a mutation in another workspace.
 */
export function usePortfolio(refreshToken = 0): PortfolioResult {
  const [state, setState] = useState<PortfolioState>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    Promise.all([api.listPortfolio(), api.getValuations()])
      .then(([positions, valuations]) => {
        if (!active) return
        setState({ status: 'ready', data: { positions, valuations }, error: null })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setState({ status: 'error', data: null, error: caught })
      })

    return () => {
      active = false
    }
  }, [refreshToken, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { ...state, reload }
}
