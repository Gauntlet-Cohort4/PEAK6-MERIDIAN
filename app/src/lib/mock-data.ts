/**
 * @module mock-data
 * Realistic mock data for Stage A development.
 */

import { MarketStatus } from '@meridian/shared/types';
import type {
  StrikeMarket,
  OrderBookState,
  OrderBookEntry,
  PriceData,
  Position,
} from '@meridian/shared/types';

const now = Date.now();

export const MOCK_MARKETS: readonly StrikeMarket[] = [
  {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    ticker: 'AAPL',
    strikePrice: 230,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'AaPL1yEs111111111111111111111111111111111111',
    noTokenMint: 'AaPL1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-aapl-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  {
    address: '5nfGF5x3HK7d8sQKrEfZn4TqPLgQ8Y3JKiUqzsXkFVrR',
    ticker: 'NVDA',
    strikePrice: 140,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'NvdA1yEs111111111111111111111111111111111111',
    noTokenMint: 'NvdA1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-nvda-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  {
    address: '3mTT8x7QLZG4N9HfC5k2RDRZ9xY8qJmNJDcXfVnEtBb',
    ticker: 'TSLA',
    strikePrice: 280,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'TsLa1yEs111111111111111111111111111111111111',
    noTokenMint: 'TsLa1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-tsla-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  {
    address: '9pQQ2y5HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'MSFT',
    strikePrice: 430,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'MsFt1yEs111111111111111111111111111111111111',
    noTokenMint: 'MsFt1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-msft-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  {
    address: '6kLL1x8HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'GOOGL',
    strikePrice: 180,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'GoOgL1yEs111111111111111111111111111111111111',
    noTokenMint: 'GoOgL1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-googl-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  {
    address: '8pRR3y6HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'AMZN',
    strikePrice: 200,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'AmZn1yEs111111111111111111111111111111111111',
    noTokenMint: 'AmZn1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-amzn-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  {
    address: '2mSS4z7HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'META',
    strikePrice: 680,
    expiryTimestamp: now + 6 * 3600 * 1000,
    status: MarketStatus.OPEN,
    yesTokenMint: 'MeTa1yEs111111111111111111111111111111111111',
    noTokenMint: 'MeTa1No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-meta-feed',
    settlementPrice: null,
    createdAt: now - 2 * 3600 * 1000,
    settledAt: null,
  },
  // Settled market for redemption demo
  {
    address: '4xWW5y9HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'AAPL',
    strikePrice: 225,
    expiryTimestamp: now - 2 * 3600 * 1000,
    status: MarketStatus.SETTLED,
    yesTokenMint: 'AaPL2yEs111111111111111111111111111111111111',
    noTokenMint: 'AaPL2No1111111111111111111111111111111111111',
    oracleFeedId: 'pyth-aapl-feed',
    settlementPrice: 228.5, // Above strike = YES wins
    createdAt: now - 10 * 3600 * 1000,
    settledAt: now - 2 * 3600 * 1000,
  },
] as const;

const MOCK_SIZES = [35, 22, 48, 15, 42, 28, 51, 19, 37, 44];

function makeBids(basePrice: number, count: number): OrderBookEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    price: parseFloat((basePrice - i * 0.01).toFixed(2)),
    size: MOCK_SIZES[i % MOCK_SIZES.length] ?? 25,
    side: 'bid' as const,
  }));
}

function makeAsks(basePrice: number, count: number): OrderBookEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    price: parseFloat((basePrice + i * 0.01).toFixed(2)),
    size: MOCK_SIZES[(i + 5) % MOCK_SIZES.length] ?? 25,
    side: 'ask' as const,
  }));
}

export const MOCK_ORDER_BOOKS: Record<string, OrderBookState> = {
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU': {
    marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    bids: makeBids(0.64, 5),
    asks: makeAsks(0.66, 5),
    lastUpdated: now,
    spread: 0.02,
  },
  '5nfGF5x3HK7d8sQKrEfZn4TqPLgQ8Y3JKiUqzsXkFVrR': {
    marketAddress: '5nfGF5x3HK7d8sQKrEfZn4TqPLgQ8Y3JKiUqzsXkFVrR',
    bids: makeBids(0.55, 5),
    asks: makeAsks(0.58, 5),
    lastUpdated: now,
    spread: 0.03,
  },
  '3mTT8x7QLZG4N9HfC5k2RDRZ9xY8qJmNJDcXfVnEtBb': {
    marketAddress: '3mTT8x7QLZG4N9HfC5k2RDRZ9xY8qJmNJDcXfVnEtBb',
    bids: makeBids(0.42, 5),
    asks: makeAsks(0.45, 5),
    lastUpdated: now,
    spread: 0.03,
  },
  '9pQQ2y5HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr': {
    marketAddress: '9pQQ2y5HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    bids: makeBids(0.71, 5),
    asks: makeAsks(0.73, 5),
    lastUpdated: now,
    spread: 0.02,
  },
  '6kLL1x8HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr': {
    marketAddress: '6kLL1x8HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    bids: makeBids(0.47, 5),
    asks: makeAsks(0.50, 5),
    lastUpdated: now,
    spread: 0.03,
  },
  '8pRR3y6HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr': {
    marketAddress: '8pRR3y6HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    bids: makeBids(0.49, 5),
    asks: makeAsks(0.52, 5),
    lastUpdated: now,
    spread: 0.03,
  },
  '2mSS4z7HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr': {
    marketAddress: '2mSS4z7HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    bids: makeBids(0.58, 5),
    asks: makeAsks(0.61, 5),
    lastUpdated: now,
    spread: 0.03,
  },
};

export const MOCK_PRICES: Record<string, PriceData> = {
  AAPL: {
    price: 228.5,
    confidence: 0.15,
    timestamp: now,
    feedId: 'pyth-aapl-feed',
    source: 'pyth',
  },
  NVDA: {
    price: 138.75,
    confidence: 0.25,
    timestamp: now,
    feedId: 'pyth-nvda-feed',
    source: 'pyth',
  },
  TSLA: {
    price: 275.3,
    confidence: 0.5,
    timestamp: now,
    feedId: 'pyth-tsla-feed',
    source: 'pyth',
  },
  MSFT: {
    price: 432.1,
    confidence: 0.2,
    timestamp: now,
    feedId: 'pyth-msft-feed',
    source: 'pyth',
  },
  GOOGL: {
    price: 178.3,
    confidence: 0.12,
    timestamp: now,
    feedId: 'pyth-googl-feed',
    source: 'pyth',
  },
  AMZN: {
    price: 198.5,
    confidence: 0.18,
    timestamp: now,
    feedId: 'pyth-amzn-feed',
    source: 'pyth',
  },
  META: {
    price: 685.2,
    confidence: 0.35,
    timestamp: now,
    feedId: 'pyth-meta-feed',
    source: 'pyth',
  },
};

export const MOCK_POSITIONS: readonly Position[] = [
  {
    marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    ticker: 'AAPL',
    strikePrice: 230,
    yesTokenBalance: 25,
    noTokenBalance: 0,
    avgEntryPrice: 0.6,
    unrealizedPnl: 1.25,
  },
  {
    marketAddress: '5nfGF5x3HK7d8sQKrEfZn4TqPLgQ8Y3JKiUqzsXkFVrR',
    ticker: 'NVDA',
    strikePrice: 140,
    yesTokenBalance: 0,
    noTokenBalance: 15,
    avgEntryPrice: 0.4,
    unrealizedPnl: -0.75,
  },
  // Settled winning position (YES won, user holds YES)
  {
    marketAddress: '4xWW5y9HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'AAPL',
    strikePrice: 225,
    yesTokenBalance: 10,
    noTokenBalance: 0,
    avgEntryPrice: 0.55,
    unrealizedPnl: 4.5,
  },
  // Active position on META
  {
    marketAddress: '2mSS4z7HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
    ticker: 'META',
    strikePrice: 680,
    yesTokenBalance: 20,
    noTokenBalance: 0,
    avgEntryPrice: 0.48,
    unrealizedPnl: 2.0,
  },
];
