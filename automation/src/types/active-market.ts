/**
 * @module active-market
 * Shared type for an unsettled on-chain strike market.
 */

import type { SupportedTicker } from '@meridian/shared/constants.js';

/** Represents an active (unsettled) market queried from on-chain state. */
export interface ActiveMarket {
  readonly ticker: SupportedTicker;
  readonly strikePrice: number;
  readonly marketAddress: string;
  /** Base58-encoded Pyth price account public key from the TickerConfig. */
  readonly pythPriceAccount: string;
}
