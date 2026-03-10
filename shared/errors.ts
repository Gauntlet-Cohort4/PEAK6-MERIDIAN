/**
 * @module errors
 * Centralized error types for the Meridian platform.
 */

/** All known error codes in the Meridian system. */
export enum MeridianErrorCode {
  MARKET_ALREADY_SETTLED = 'MARKET_ALREADY_SETTLED',
  ORACLE_PRICE_STALE = 'ORACLE_PRICE_STALE',
  ORACLE_CONFIDENCE_TOO_WIDE = 'ORACLE_CONFIDENCE_TOO_WIDE',
  MARKET_NOT_SETTLEABLE = 'MARKET_NOT_SETTLEABLE',
  ADMIN_SETTLE_TOO_EARLY = 'ADMIN_SETTLE_TOO_EARLY',
  PROGRAM_PAUSED = 'PROGRAM_PAUSED',
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  RPC_ERROR = 'RPC_ERROR',
  PHOENIX_SDK_ERROR = 'PHOENIX_SDK_ERROR',
  PHOENIX_INTEROP_ERROR = 'PHOENIX_INTEROP_ERROR',
  PYTH_HERMES_ERROR = 'PYTH_HERMES_ERROR',
  FINNHUB_API_ERROR = 'FINNHUB_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DEMO_MODE_ERROR = 'DEMO_MODE_ERROR',
}

/**
 * Structured error class for all Meridian operations.
 * Carries an error code, human-readable message, optional cause, and context.
 */
export class MeridianError extends Error {
  public override readonly name = 'MeridianError' as const;

  constructor(
    public readonly code: MeridianErrorCode,
    message: string,
    public override readonly cause?: unknown,
    public readonly context?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    Object.setPrototypeOf(this, MeridianError.prototype);
  }

  /**
   * Serialize the error to a plain object for logging or transmission.
   * Returns a new object; does not mutate the error instance.
   */
  toJSON(): Readonly<Record<string, unknown>> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Type guard to check whether an unknown value is a MeridianError.
 */
export function isMeridianError(value: unknown): value is MeridianError {
  return value instanceof MeridianError;
}
