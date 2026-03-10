/**
 * @module implied-probability
 * Calculate implied probability from order book mid-price.
 */

/**
 * Calculate implied probability from best bid and ask prices.
 * Returns null if both sides are missing.
 *
 * - If both bid and ask exist: mid-price = (bid + ask) / 2
 * - If only one side exists: use that price (low liquidity)
 * - If neither exists: return null
 */
export function calcImpliedProbability(
  bestBid: number | null,
  bestAsk: number | null,
): number | null {
  if (bestBid !== null && bestAsk !== null) {
    return (bestBid + bestAsk) / 2;
  }
  if (bestBid !== null) {
    return bestBid;
  }
  if (bestAsk !== null) {
    return bestAsk;
  }
  return null;
}

/**
 * Check if the order book is one-sided (only bids or only asks).
 */
export function isOneSidedBook(
  bestBid: number | null,
  bestAsk: number | null,
): boolean {
  return (bestBid === null) !== (bestAsk === null);
}
