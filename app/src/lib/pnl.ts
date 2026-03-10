/**
 * @module pnl
 * Profit & Loss calculation utilities.
 */

export interface PnlInput {
  /** Number of tokens held (positive for long). */
  readonly quantity: number;
  /** Average price paid per token. */
  readonly avgEntryPrice: number;
  /** Current market price of the token. */
  readonly currentPrice: number;
}

export interface PnlResult {
  /** Absolute P&L in USD. */
  readonly pnl: number;
  /** P&L as a percentage of cost basis. */
  readonly pnlPercent: number;
  /** Total cost basis. */
  readonly costBasis: number;
  /** Current market value. */
  readonly marketValue: number;
}

/**
 * Calculate P&L for a position.
 * Returns zero values if quantity is zero.
 */
export function calculatePnl(input: PnlInput): PnlResult {
  const { quantity, avgEntryPrice, currentPrice } = input;

  if (quantity === 0) {
    return { pnl: 0, pnlPercent: 0, costBasis: 0, marketValue: 0 };
  }

  const costBasis = quantity * avgEntryPrice;
  const marketValue = quantity * currentPrice;
  const pnl = marketValue - costBasis;
  const pnlPercent = costBasis !== 0 ? pnl / costBasis : 0;

  return { pnl, pnlPercent, costBasis, marketValue };
}
