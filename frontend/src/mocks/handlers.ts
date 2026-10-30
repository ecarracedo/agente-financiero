import { http, HttpResponse } from 'msw'

import type { MutationResponse, PortfolioPosition, TransactionSummary } from '../api/client'
import type { AlertCheck } from '../features/alerts/alertApi'
import type { BibliographyItem } from '../features/bibliography/bibliographyApi'
import type { SplitProjection } from '../features/tools/split/splitApi'
import type { WishlistItem } from '../features/wishlist/wishlistApi'
import {
  alertCheckClear,
  alertCheckTriggered,
  analysisAAPL,
  bibliography,
  portfolioItems,
  splitResult,
  tickerSearchResults,
  transactions,
  unknownAnalysis,
  valuations,
  wishlist,
} from './fixtures'

/**
 * MSW handlers for every route the frontend consumes.
 *
 * The paths mirror `frontend/openapi.json` exactly, including `/health` and
 * `/ready`, which are served outside the `/api/v1` prefix. Two shapes are not
 * the obvious ones and are called out at their handler: valuations are a
 * currency-keyed object, and a wishlist alert check takes no request body.
 *
 * `BASE` is a `*` wildcard, so a handler matches the route whatever origin the
 * client builds. Under test the client resolves an absolute
 * `http://localhost:8000`, and in demo mode the browser resolves the dev server;
 * a bare path matches neither.
 *
 * `src/mocks/contract.test.ts` reads the OpenAPI document and fails when a path
 * here stops existing in the contract, so this file cannot drift silently.
 */

const BASE = '*'

/** Valuations are keyed by currency, not returned as a list. */
function valuationsByCurrency() {
  return Object.fromEntries(valuations.map((entry) => [entry.currency, entry]))
}

export const handlers = [
  // Health and readiness answer from the public origin, outside /api/v1.
  http.get(`${BASE}/health`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${BASE}/ready`, () => HttpResponse.json({ status: 'ready' })),

  http.get(`${BASE}/api/v1/portfolio`, () =>
    HttpResponse.json<PortfolioPosition[]>(portfolioItems),
  ),

  // The client normalizes this object into an array with Object.values.
  http.get(`${BASE}/api/v1/valuations`, () => HttpResponse.json(valuationsByCurrency())),

  http.get(`${BASE}/api/v1/transactions`, () =>
    HttpResponse.json<TransactionSummary[]>(transactions),
  ),
  http.post(`${BASE}/api/v1/transactions`, async ({ request }) => {
    const body = (await request.json()) as TransactionSummary
    // The contract answers with the resulting position, or null.
    const position = portfolioItems.find((item) => item.ticker === body.ticker) ?? null
    return HttpResponse.json<PortfolioPosition | null>(position, { status: 201 })
  }),
  http.delete(`${BASE}/api/v1/transactions/:transaction_id`, () =>
    HttpResponse.json<MutationResponse>({ deleted: true }),
  ),

  http.get(`${BASE}/api/v1/tickers/search`, ({ request }) => {
    const url = new URL(request.url)
    const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const matches = query
      ? tickerSearchResults.filter(
          (match) =>
            match.symbol.toLowerCase().includes(query) ||
            match.name.toLowerCase().includes(query),
        )
      : []
    return HttpResponse.json(matches)
  }),

  http.get(`${BASE}/api/v1/analysis/:ticker`, ({ params }) => {
    const ticker = String(params.ticker)
    if (ticker === 'ZZZZ') return HttpResponse.json(unknownAnalysis)
    return HttpResponse.json(analysisAAPL)
  }),

  // A portfolio alert is configured per ticker.
  http.put(`${BASE}/api/v1/portfolio/:ticker/alert`, () =>
    HttpResponse.json({ configured: true }),
  ),
  // The check carries the observed price and the derived event, or null.
  http.post(`${BASE}/api/v1/portfolio/:ticker/alert/check`, ({ params }) => {
    const ticker = String(params.ticker)
    const check: AlertCheck =
      ticker === 'MSFT' ? alertCheckClear : alertCheckTriggered
    return HttpResponse.json(check)
  }),

  http.get(`${BASE}/api/v1/wishlist`, () =>
    HttpResponse.json<WishlistItem[]>(wishlist),
  ),
  http.post(`${BASE}/api/v1/wishlist`, async ({ request }) => {
    const body = (await request.json()) as { ticker: string; target_price?: string | null }
    return HttpResponse.json<WishlistItem>(
      { ticker: body.ticker, target_price: body.target_price ?? null },
      { status: 201 },
    )
  }),
  http.delete(`${BASE}/api/v1/wishlist/:ticker`, () =>
    HttpResponse.json<MutationResponse>({ deleted: true }),
  ),
  http.put(`${BASE}/api/v1/wishlist/:ticker/target`, () =>
    HttpResponse.json({ updated: true }),
  ),

  // A wishlist alert is configured per ticker.
  http.put(`${BASE}/api/v1/wishlist/:ticker/alert`, () =>
    HttpResponse.json({ configured: true }),
  ),
  // This check sends no request body, so there is nothing to read from it.
  http.post(`${BASE}/api/v1/wishlist/:ticker/alert/check`, () =>
    HttpResponse.json<AlertCheck>(alertCheckTriggered),
  ),

  http.get(`${BASE}/api/v1/bibliography`, () =>
    HttpResponse.json<BibliographyItem[]>(bibliography),
  ),
  http.post(`${BASE}/api/v1/bibliography`, async ({ request }) => {
    const body = (await request.json()) as Omit<BibliographyItem, 'id'>
    return HttpResponse.json<BibliographyItem>(
      { ...body, id: bibliography.length + 1 },
      { status: 201 },
    )
  }),
  http.delete(`${BASE}/api/v1/bibliography/:item_id`, () =>
    HttpResponse.json<MutationResponse>({ deleted: true }),
  ),

  http.post(`${BASE}/api/v1/splits`, () =>
    HttpResponse.json<SplitProjection>(splitResult),
  ),
]
