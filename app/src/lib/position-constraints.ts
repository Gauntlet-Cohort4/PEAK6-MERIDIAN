/**
 * @module position-constraints
 * Determine available trade sides based on current positions.
 *
 * Rules:
 * - Cannot Buy Yes if holding No tokens (and vice versa)
 * - Can always Sell tokens you hold
 * - If no position, can Buy Yes or Buy No (but not both simultaneously)
 */

import { TradeSide } from '@meridian/shared/types';
import type { Position } from '@meridian/shared/types';

export interface PositionConstraints {
  readonly availableSides: readonly TradeSide[];
  readonly holdingYes: boolean;
  readonly holdingNo: boolean;
}

/**
 * Get available trade sides given a user's position in a market.
 * Returns null-safe results for undefined positions.
 */
export function getAvailableTrades(
  position: Position | null,
): PositionConstraints {
  if (position === null) {
    return {
      availableSides: [TradeSide.BUY_YES, TradeSide.BUY_NO],
      holdingYes: false,
      holdingNo: false,
    };
  }

  const holdingYes = position.yesTokenBalance > 0;
  const holdingNo = position.noTokenBalance > 0;
  const sides: TradeSide[] = [];

  if (holdingYes && holdingNo) {
    // Holding both is transient (from mint) — only allow selling to close one side
    sides.push(TradeSide.SELL_YES, TradeSide.SELL_NO);
  } else if (holdingYes) {
    sides.push(TradeSide.BUY_YES, TradeSide.SELL_YES);
  } else if (holdingNo) {
    sides.push(TradeSide.BUY_NO, TradeSide.SELL_NO);
  } else {
    sides.push(TradeSide.BUY_YES, TradeSide.BUY_NO);
  }

  return { availableSides: sides, holdingYes, holdingNo };
}

/**
 * Check if a specific trade side is allowed given position constraints.
 */
export function isTradeSideAllowed(
  side: TradeSide,
  position: Position | null,
): boolean {
  const { availableSides } = getAvailableTrades(position);
  return availableSides.includes(side);
}
