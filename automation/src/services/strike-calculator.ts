/**
 * @module strike-calculator
 * Strike price calculation logic for binary options markets.
 * Generates a set of strike prices centered around the previous close.
 */

import { MERIDIAN_CONFIG } from '@meridian/shared/constants.js';

/**
 * Calculate strike prices based on a previous close price.
 *
 * Process:
 * 1. Round close price to nearest STRIKE_ROUNDING increment
 * 2. Generate strikes at configured percentage offsets (both above and below)
 * 3. Include the rounded center strike
 * 4. Sort ascending and deduplicate
 *
 * @param closePrice - The previous day's closing price
 * @returns Sorted array of unique strike prices
 */
export function calculateStrikes(closePrice: number): readonly number[] {
  if (closePrice <= 0) {
    throw new Error(`Invalid close price: ${closePrice}. Must be positive.`);
  }

  const rounded = Math.round(closePrice / MERIDIAN_CONFIG.STRIKE_ROUNDING)
    * MERIDIAN_CONFIG.STRIKE_ROUNDING;

  const strikes = MERIDIAN_CONFIG.STRIKE_OFFSETS_PERCENT
    .flatMap((offset) => [
      Math.round(rounded * (1 - offset / 100)),
      Math.round(rounded * (1 + offset / 100)),
    ])
    .concat([rounded]);

  // Deduplicate and sort ascending
  const unique = [...new Set(strikes)].sort((a, b) => a - b);

  return Object.freeze(unique);
}

/**
 * Validate that a set of strikes meets minimum requirements.
 *
 * @param strikes - Array of strike prices to validate
 * @returns true if the strikes are valid
 */
export function validateStrikes(strikes: readonly number[]): boolean {
  if (strikes.length === 0) {
    return false;
  }

  // All strikes must be positive
  if (strikes.some((s) => s <= 0)) {
    return false;
  }

  // Strikes must be sorted ascending
  for (let i = 1; i < strikes.length; i++) {
    if (strikes[i]! <= strikes[i - 1]!) {
      return false;
    }
  }

  return true;
}
