/**
 * @module format
 * Price and number formatting utilities.
 */

/**
 * Format a number as USD currency string.
 * Example: 0.65 -> "$0.65"
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as a percentage string.
 * Example: 0.65 -> "65.0%"
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a price value with 2 decimal places.
 * Example: 0.65 -> "0.65"
 */
export function formatPrice(value: number): string {
  return value.toFixed(2);
}

/**
 * Truncate a Solana address for display.
 * Example: "7xKXtg2C...vE9oS" -> "7xKX...9oS"
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) {
    return address;
  }
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
