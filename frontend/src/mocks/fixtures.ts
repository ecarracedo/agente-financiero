/**
 * Shared MSW fixtures used by both browser (dev) and node (tests).
 *
 * Every shape here mirrors `frontend/openapi.json`. `src/mocks/contract.test.ts`
 * reads that document and fails when a fixture stops matching its response
 * schema, so a backend contract change surfaces here instead of as `undefined`
 * in a view.
 */

/** PortfolioPositionResponse */
export const portfolioItems = [
  {
    ticker: 'AAPL',
    broker: 'IBKR',
    category: 'Stock',
    quantity: '10',
    average_price: '150.25',
    currency: 'USD',
  },
  {
    ticker: 'MSFT',
    broker: 'IBKR',
    category: 'Stock',
    quantity: '5',
    average_price: '280.00',
    currency: 'USD',
  },
]

/**
 * CurrencyValuationResponse.
 *
 * One entry per currency, not per ticker: the backend groups the portfolio by
 * currency and reports `unpriced_tickers` for the positions it could not value.
 */
export const valuations = [
  {
    currency: 'USD',
    invested_value: '2902.50',
    market_value: '3400.00',
    gain_loss: '497.50',
    gain_loss_percent: '+17.14',
    unpriced_tickers: [],
  },
  {
    currency: 'EUR',
    invested_value: '1200.00',
    // A currency with no priced position reports a null valuation, not zero.
    market_value: null,
    gain_loss: null,
    gain_loss_percent: null,
    unpriced_tickers: ['SAP'],
  },
]

/** TransactionSummaryResponse */
export const transactions = [
  {
    id: 1,
    ticker: 'AAPL',
    broker: 'IBKR',
    category: 'Stock',
    operation_type: 'BUY',
    quantity: '10',
    unit_price: '150.25',
    currency: 'USD',
    occurred_at: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    ticker: 'MSFT',
    broker: 'IBKR',
    category: 'Stock',
    operation_type: 'BUY',
    quantity: '5',
    unit_price: '280.00',
    currency: 'USD',
    occurred_at: '2024-01-02T10:00:00',
  },
]

/** WishlistItemResponse */
export const wishlist = [
  {
    ticker: 'NVDA',
    target_price: '120.00',
  },
  {
    ticker: 'TSLA',
    target_price: '250.00',
  },
]

/** MarketAnalysisResponse, with series points as PricePointResponse. */
export const analysisAAPL = {
  ticker: 'AAPL',
  status: 'OK' as const,
  reason: null,
  current_price: '190.00',
  high_52_week: '200.00',
  low_52_week: '150.00',
  moving_average_50: '180.00',
  moving_average_200: null,
  signals: ['NEAR_52_WEEK_HIGH'],
  series: [
    { date: '2024-01-01', close: '160.00' },
    { date: '2024-02-01', close: '175.00' },
    { date: '2024-03-01', close: '190.00' },
  ],
}

/** MarketAnalysisResponse for a ticker with no current price. */
export const unknownAnalysis = {
  ticker: 'ZZZZ',
  status: 'UNKNOWN' as const,
  reason: 'No current market price',
  current_price: null,
  high_52_week: null,
  low_52_week: null,
  moving_average_50: null,
  moving_average_200: null,
  signals: [],
  series: [],
}

/**
 * AlertCheckResponse with a crossing event.
 *
 * A check reports the price it observed plus the event the backend derived; it
 * carries no intent or trigger of its own, because a crossing is never
 * re-emitted client-side.
 */
export const alertCheckTriggered = {
  current_price: '190.00',
  event: {
    intent: 'BUY' as const,
    message: 'Price below target',
  },
}

/** AlertCheckResponse with no crossing: the price is known, the event is null. */
export const alertCheckClear = {
  current_price: '190.00',
  event: null,
}

/** BibliographyItemResponse */
export const bibliography = [
  {
    id: 1,
    title: 'Risk and Return',
    author: 'Merton Miller',
    year: 1991,
    category: 'Paper',
    link: 'https://example.test/risk-and-return',
    description: 'Foundational reading on portfolio theory.',
  },
  {
    id: 2,
    title: 'Security Analysis',
    author: 'Benjamin Graham',
    // A source with no publication year is stored as null, not as an empty string.
    year: null,
    category: 'Book',
    link: null,
    description: null,
  },
]

/** SplitProjectionResponse. */
export const splitResult = {
  quantity: '100',
  average_price: '150.25',
  ratio: '2:1',
}
