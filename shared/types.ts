/**
 * @module types
 * Shared TypeScript interfaces and enums for the Meridian platform.
 */

import type { SupportedTicker } from './constants';

/** Current status of a prediction market. */
export enum MarketStatus {
  /** Market created but not yet open for trading. */
  PENDING = 'PENDING',
  /** Market is open and accepting orders. */
  OPEN = 'OPEN',
  /** Market has closed; awaiting settlement. */
  CLOSED = 'CLOSED',
  /** Market has been settled; outcomes determined. */
  SETTLED = 'SETTLED',
  /** Market was cancelled before settlement. */
  CANCELLED = 'CANCELLED',
}

/** Direction of a trade in the binary options market. */
export enum TradeSide {
  BUY_YES = 'BUY_YES',
  BUY_NO = 'BUY_NO',
  SELL_YES = 'SELL_YES',
  SELL_NO = 'SELL_NO',
}

/** On-chain strike market account data (mirrors the Anchor struct). */
export interface StrikeMarket {
  readonly address: string;
  readonly ticker: SupportedTicker;
  readonly strikePrice: number;
  readonly expiryTimestamp: number;
  readonly status: MarketStatus;
  readonly yesTokenMint: string;
  readonly noTokenMint: string;
  readonly oracleFeedId: string;
  readonly settlementPrice: number | null;
  readonly createdAt: number;
  readonly settledAt: number | null;
}

/** Configuration for a single tradeable ticker. */
export interface TickerConfig {
  readonly ticker: SupportedTicker;
  readonly pythFeedId: string;
  readonly finnhubSymbol: string;
  readonly enabled: boolean;
}

/** Top-level platform configuration loaded from environment. */
export interface MeridianConfig {
  readonly rpcUrl: string;
  readonly adminKeypairPath: string;
  readonly pythHermesEndpoint: string;
  readonly finnhubApiKey: string;
  readonly tickers: readonly TickerConfig[];
  readonly demoMode: boolean;
}

/** A single entry in an order book (price level). */
export interface OrderBookEntry {
  readonly price: number;
  readonly size: number;
  readonly side: 'bid' | 'ask';
}

/** Snapshot of an order book for a single market. */
export interface OrderBookState {
  readonly marketAddress: string;
  readonly bids: readonly OrderBookEntry[];
  readonly asks: readonly OrderBookEntry[];
  readonly lastUpdated: number;
  readonly spread: number | null;
}

/** Price data from an oracle or price service. */
export interface PriceData {
  readonly price: number;
  readonly confidence: number;
  readonly timestamp: number;
  readonly feedId: string;
  readonly source: string;
}

/** Parameters for placing a trade order. */
export interface TradeOrder {
  readonly marketAddress: string;
  readonly side: TradeSide;
  readonly size: number;
  readonly price: number;
  readonly traderPublicKey: string;
}

/** A trader's position in a specific market. */
export interface Position {
  readonly marketAddress: string;
  readonly ticker: SupportedTicker;
  readonly strikePrice: number;
  readonly yesTokenBalance: number;
  readonly noTokenBalance: number;
  readonly avgEntryPrice: number;
  readonly unrealizedPnl: number;
}
