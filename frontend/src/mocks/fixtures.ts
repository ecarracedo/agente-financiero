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
    broker: 'ECO',
    category: 'Acciones',
    quantity: '10',
    average_price: '150.25',
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
    // `format_money` emits a minus for negatives and nothing for positives, so a
    // gain arrives unsigned. The frontend derives the plus it displays.
    gain_loss: '497.50',
    gain_loss_percent: '17.14',
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
  currency: 'USD' as const,
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

/** MarketAnalysisResponse for an Argentine listing quoted in pesos. */
export const analysisPAMP = {
  ticker: 'PAMP.BA',
  status: 'OK' as const,
  reason: null,
  current_price: '4802.50',
  currency: 'ARS' as const,
  high_52_week: '5200.00',
  low_52_week: '2100.00',
  moving_average_50: '4400.00',
  moving_average_200: null,
  signals: ['NEAR_52_WEEK_HIGH'],
  series: [
    { date: '2024-01-01', close: '2100.00' },
    { date: '2024-02-01', close: '3500.00' },
    { date: '2024-03-01', close: '4802.50' },
  ],
}

/** TickerMatchResponse[] served by the asset search endpoint. */
export const tickerSearchResults = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    quote_type: 'Equity',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    quote_type: 'Equity',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    quote_type: 'Equity',
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin USD',
    exchange: 'CCC',
    quote_type: 'Cryptocurrency',
  },
  {
    symbol: 'PAM',
    name: 'Pampa Energía S.A.',
    exchange: 'NYSE',
    quote_type: 'Equity',
  },
  {
    symbol: 'PAMP.BA',
    name: 'Pampa Energía S.A.',
    exchange: 'Buenos Aires',
    quote_type: 'Equity',
  },
]

/** MarketAnalysisResponse for a ticker with no current price. */export const unknownAnalysis = {
  ticker: 'ZZZZ',
  status: 'UNKNOWN' as const,
  reason: 'No current market price',
  current_price: null,
  currency: null,
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

/** TickerAliasResponse. */
export const tickerAliases = [
  {
    id: 1,
    broker_ticker: 'AAPL',
    official_name: 'Allaria Diversificado Clase A',
    provider: 'ppi',
  },
]

/** TickerMatchResponse. */
export const ppiInstruments = [
  {
    symbol: 'ALLARIA DIVERSIFICADO CLASE A',
    name: 'FCI Allaria Diversificado Clase A',
    exchange: 'CAFCI',
    quote_type: 'Mutual Fund',
  },
  {
    symbol: 'AE38',
    name: 'Bono AE38',
    exchange: 'BYMA',
    quote_type: 'Bond',
  },
]
