/**
 * Shared MSW fixtures used by both browser (dev) and node (tests).
 */

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

export const valuations = [
  {
    ticker: 'AAPL',
    broker: 'IBKR',
    valuation: '1900.00',
    currency: 'USD',
    day_change: '+50.00',
    day_change_percent: '+2.70',
  },
  {
    ticker: 'MSFT',
    broker: 'IBKR',
    valuation: '1500.00',
    currency: 'USD',
    day_change: '-10.00',
    day_change_percent: '-0.66',
  },
]

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

export const marketPortfolio = portfolioItems.map((item) => ({
  ...item,
}))

export const marketTransactions = transactions.map((t) => ({ ...t }))

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

export const alertsPortfolio = {
  ticker: 'AAPL',
  intent: 'NEUTRAL' as const,
  triggered: false,
  message: 'Price within target range',
  current_price: '190.00',
  target_price: '200.00',
}

export const alertsWishlist = {
  ticker: 'NVDA',
  intent: 'BUY' as const,
  triggered: true,
  message: 'Price below target',
  current_price: '110.00',
  target_price: '120.00',
}

export const bibliography = [
  {
    ticker: 'AAPL',
    source: '10-K',
    description: 'Annual report',
  },
  {
    ticker: 'MSFT',
    source: 'Quarterly call',
    description: 'Q4 earnings',
  },
]

export const splitResult = {
  pre_split_shares: '100',
  split_ratio: '2:1',
  post_split_shares: '200',
  adjusted_average_price: '75.125',
  currency: 'USD',
}
