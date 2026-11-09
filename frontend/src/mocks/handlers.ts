import { http, HttpResponse } from 'msw'

import type { MutationResponse, PortfolioPosition, TickerAliasResponse, TransactionSummary } from '../api/client'
import type { AlertCheck } from '../features/alerts/alertApi'
import type { BibliographyItem } from '../features/bibliography/bibliographyApi'
import type { SplitProjection } from '../features/tools/split/splitApi'
import type { WishlistItem } from '../features/wishlist/wishlistApi'
import {
  alertCheckClear,
  alertCheckTriggered,
  analysisAAPL,
  analysisPAMP,
  bibliography,
  dollarRates,
  portfolioItems,
  splitResult,
  tickerAliases,
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

  http.get(`${BASE}/api/v1/auth/me`, () =>
    HttpResponse.json({ username: 'ecarracedo', email: 'ecarracedo@gmail.com', totp_enabled: false }),
  ),
  http.post(`${BASE}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username?: string; password?: string }
    if (body.username === 'ecarracedo' && body.password === 'correct-password') {
      return HttpResponse.json({ status: 'ok', username: 'ecarracedo', totp_enabled: false })
    }
    return HttpResponse.json({ detail: 'invalid credentials' }, { status: 401 })
  }),
  http.post(`${BASE}/api/v1/auth/verify-totp`, () =>
    HttpResponse.json({ status: 'ok', username: 'ecarracedo', totp_enabled: true }),
  ),
  http.post(`${BASE}/api/v1/auth/logout`, () =>
    HttpResponse.json({ status: 'ok', username: null, totp_enabled: false }),
  ),
  http.post(`${BASE}/api/v1/auth/totp/setup`, () =>
    HttpResponse.json({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_url: 'otpauth://totp/Agente%20Financiero:ecarracedo%40gmail.com?secret=JBSWY3DPEHPK3PXP',
    }),
  ),
  http.post(`${BASE}/api/v1/auth/totp/confirm`, () =>
    HttpResponse.json({ username: 'ecarracedo', email: 'ecarracedo@gmail.com', totp_enabled: true }),
  ),
  http.post(`${BASE}/api/v1/auth/totp/disable`, () =>
    HttpResponse.json({ username: 'ecarracedo', email: 'ecarracedo@gmail.com', totp_enabled: false }),
  ),

  http.get(`${BASE}/api/v1/portfolio`, () =>
    HttpResponse.json<PortfolioPosition[]>(portfolioItems),
  ),

  // The client normalizes this object into an array with Object.values.
  http.get(`${BASE}/api/v1/valuations`, () => HttpResponse.json(valuationsByCurrency())),

  http.get(`${BASE}/api/v1/fx/dollars`, () => HttpResponse.json(dollarRates)),

  http.get(`${BASE}/api/v1/transactions`, () =>
    HttpResponse.json<TransactionSummary[]>(transactions),
  ),
  http.post(`${BASE}/api/v1/transactions`, async ({ request }) => {
    const body = (await request.json()) as TransactionSummary
    // The contract answers with the resulting position, or null.
    const position = (portfolioItems as PortfolioPosition[]).find((item) => item.ticker === body.ticker) ?? null
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

  // Alias rows are keyed by broker ticker; the list is static so a test never
  // leaks a created row into the next one.
  http.get(`${BASE}/api/v1/ticker-aliases`, () =>
    HttpResponse.json<TickerAliasResponse[]>(tickerAliases),
  ),
  http.post(`${BASE}/api/v1/ticker-aliases`, async ({ request }) => {
    const body = (await request.json()) as {
      broker_ticker: string
      official_name: string
      provider?: string
    }
    return HttpResponse.json<TickerAliasResponse>(
      {
        id: 99,
        broker_ticker: body.broker_ticker,
        official_name: body.official_name,
        provider: body.provider ?? 'ppi',
      },
      { status: 201 },
    )
  }),
  http.delete(`${BASE}/api/v1/ticker-aliases/:alias_id`, () =>
    HttpResponse.json<MutationResponse>({ deleted: true }),
  ),

  http.get(`${BASE}/api/v1/analysis/:ticker`, ({ params }) => {
    const ticker = String(params.ticker)
    if (ticker === 'ZZZZ') return HttpResponse.json(unknownAnalysis)
    if (ticker.endsWith('.BA')) return HttpResponse.json(analysisPAMP)
    return HttpResponse.json(analysisAAPL)
  }),

  // A position update is addressed by ticker plus its business identity, so the
  // response is the stored row with the patched fields applied.
  http.put(`${BASE}/api/v1/portfolio/:ticker`, async ({ request, params }) => {
    const body = (await request.json()) as { broker?: string; category?: string }
    const current = (portfolioItems as PortfolioPosition[]).find(
      (item) => item.ticker === String(params.ticker),
    )
    return HttpResponse.json<PortfolioPosition | null>(
      current ? { ...current, ...body } : null,
    )
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
