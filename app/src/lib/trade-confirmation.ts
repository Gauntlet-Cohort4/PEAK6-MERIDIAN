/**
 * @module trade-confirmation
 * Manage trade confirmation dialog preferences via localStorage.
 */

const STORAGE_KEY = 'meridian_skip_trade_confirm';

/**
 * Check if the user has opted to skip trade confirmations.
 */
export function shouldSkipConfirmation(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the user's preference for skipping trade confirmations.
 */
export function setSkipConfirmation(skip: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (skip) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Silently handle storage errors (e.g., private browsing)
  }
}

/**
 * Reset the confirmation preference (re-enable confirmations).
 */
export function resetConfirmationPreference(): void {
  setSkipConfirmation(false);
}
