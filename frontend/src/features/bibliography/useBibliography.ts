/**
 * Data-fetching hook for the bibliography collection.
 */

import { useEffect, useState } from 'react'

import type { BibliographyItem } from './bibliographyApi'
import { bibliographyApi } from './bibliographyApi'

export type BibliographyStatus = 'loading' | 'ready' | 'error'

export interface BibliographyResult {
  status: BibliographyStatus
  items: BibliographyItem[]
  error: unknown
}

/**
 * Load every bibliography resource.
 *
 * State is written from the settled request only, so no synchronous state
 * update happens in the effect body.
 *
 * @param refreshToken Counter incremented after a mutation to force a refetch.
 */
export function useBibliography(refreshToken: number): BibliographyResult {
  const [state, setState] = useState<BibliographyResult>({
    status: 'loading',
    items: [],
    error: null,
  })

  useEffect(() => {
    let active = true

    bibliographyApi
      .list()
      .then((items) => {
        if (active) setState({ status: 'ready', items, error: null })
      })
      .catch((caught: unknown) => {
        if (active) setState({ status: 'error', items: [], error: caught })
      })

    return () => {
      active = false
    }
  }, [refreshToken])

  return state
}
