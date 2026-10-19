import { http, HttpResponse } from 'msw'

import {
  alertsPortfolio,
  alertsWishlist,
  analysisAAPL,
  bibliography,
  marketPortfolio,
  marketTransactions,
  portfolioItems,
  splitResult,
  transactions,
  unknownAnalysis,
  valuations,
  wishlist,
} from './fixtures'

const BASE = ''

export const handlers = [
  http.get(`${BASE}/api/v1/health`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${BASE}/api/v1/ready`, () => HttpResponse.json({ status: 'ready' })),
  http.get(`${BASE}/api/v1/portfolio`, () => HttpResponse.json(portfolioItems)),
  http.get(`${BASE}/api/v1/valuations`, () => HttpResponse.json(valuations)),
  http.get(`${BASE}/api/v1/transactions`, () => HttpResponse.json(transactions)),
  http.post(`${BASE}/api/v1/transactions`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body, id: Date.now() }, { status: 201 })
  }),
  http.delete(`${BASE}/api/v1/transactions/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${BASE}/api/v1/market/portfolio`, () => HttpResponse.json(marketPortfolio)),
  http.get(`${BASE}/api/v1/market/transactions`, () =>
    HttpResponse.json(marketTransactions),
  ),
  http.get(`${BASE}/api/v1/market/wishlist`, () => HttpResponse.json(wishlist)),
  http.get(`${BASE}/api/v1/market/analysis/:ticker`, ({ params }) => {
    const ticker = String(params.ticker)
    if (ticker === 'AAPL') {
      return HttpResponse.json(analysisAAPL)
    }
    if (ticker === 'ZZZZ') {
      return HttpResponse.json(unknownAnalysis)
    }
    return HttpResponse.json(analysisAAPL)
  }),
  http.get(`${BASE}/api/v1/alerts/portfolio`, () => HttpResponse.json(alertsPortfolio)),
  http.get(`${BASE}/api/v1/alerts/wishlist`, () => HttpResponse.json(alertsWishlist)),
  http.post(`${BASE}/api/v1/alerts/portfolio`, () => HttpResponse.json(alertsPortfolio)),
  http.post(`${BASE}/api/v1/alerts/wishlist`, () => HttpResponse.json(alertsWishlist)),
  http.get(`${BASE}/api/v1/wishlist`, () => HttpResponse.json(wishlist)),
  http.post(`${BASE}/api/v1/wishlist`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body }, { status: 201 })
  }),
  http.put(`${BASE}/api/v1/wishlist/:ticker/target`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.delete(`${BASE}/api/v1/wishlist/:ticker`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.get(`${BASE}/api/v1/bibliography`, () => HttpResponse.json(bibliography)),
  http.post(`${BASE}/api/v1/bibliography`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...body }, { status: 201 })
  }),
  http.delete(`${BASE}/api/v1/bibliography/:id`, () =>
    HttpResponse.json({ success: true }),
  ),
  http.post(`${BASE}/api/v1/tools/split`, () => HttpResponse.json(splitResult)),
]
