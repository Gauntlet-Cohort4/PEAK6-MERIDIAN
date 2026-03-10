/**
 * @module debug
 * Debug flag system for granular runtime tracing.
 * Reads environment variables once at import time.
 */

import { Logger, LogLevel } from './logger.js';

/**
 * Read a boolean flag from the environment.
 * Returns true only when the value is exactly 'true'.
 */
const envFlag = (key: string): boolean =>
  typeof process !== 'undefined' && process.env?.[key] === 'true';

/** Debug flags controlling verbose output for each subsystem. */
export const DEBUG_FLAGS = {
  PHOENIX_INTEROP: envFlag('MERIDIAN_DEBUG_PHOENIX_INTEROP'),
  ADAPTER_CALLS: envFlag('MERIDIAN_DEBUG_ADAPTERS'),
  TX_BUILDING: envFlag('MERIDIAN_DEBUG_TX'),
  ORACLE_READS: envFlag('MERIDIAN_DEBUG_ORACLE'),
  CRON_JOBS: envFlag('MERIDIAN_DEBUG_CRON'),
  ORDER_BOOK: envFlag('MERIDIAN_DEBUG_ORDERBOOK'),
  ALL: envFlag('MERIDIAN_DEBUG_ALL'),
} as const;

/** Type representing valid debug flag names. */
export type DebugFlagKey = keyof typeof DEBUG_FLAGS;

const debugLogger = new Logger('debug', { minLevel: LogLevel.DEBUG });

/**
 * Emit a debug log entry only when the given flag (or ALL) is enabled.
 * This is a no-op when the flag is off, keeping hot paths fast.
 */
export function debugLog(
  flag: DebugFlagKey,
  service: string,
  operation: string,
  message: string,
  context?: Readonly<Record<string, unknown>>,
): void {
  if (!DEBUG_FLAGS[flag] && !DEBUG_FLAGS.ALL) {
    return;
  }
  debugLogger.debug(`${service}.${operation}`, message, context);
}
