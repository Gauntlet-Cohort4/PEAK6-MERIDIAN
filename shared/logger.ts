/**
 * @module logger
 * Structured JSON logger for Meridian services.
 */

/** Log severity levels ordered by priority. */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/** Structured log entry written as JSON to stdout. */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly operation: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
    readonly cause?: string;
  };
  readonly duration_ms?: number;
}

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Resolve the minimum log level from the environment.
 * Defaults to INFO if unset or invalid.
 */
function resolveMinLevel(): LogLevel {
  const envLevel =
    typeof process !== 'undefined' ? process.env?.['MERIDIAN_LOG_LEVEL'] : undefined;
  if (envLevel && envLevel in LogLevel) {
    return envLevel as LogLevel;
  }
  return LogLevel.INFO;
}

/** Output function type for testability. */
export type LogWriter = (json: string) => void;

const defaultWriter: LogWriter = (json: string): void => {
  process.stdout.write(json + '\n');
};

/**
 * Structured JSON logger.
 * Each instance is bound to a service name; log methods produce
 * one-line JSON objects on stdout.
 */
export class Logger {
  private readonly minLevel: LogLevel;
  private readonly writer: LogWriter;

  constructor(
    private readonly service: string,
    options?: { minLevel?: LogLevel; writer?: LogWriter },
  ) {
    this.minLevel = options?.minLevel ?? resolveMinLevel();
    this.writer = options?.writer ?? defaultWriter;
  }

  /** Log at DEBUG level. */
  debug(operation: string, message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log(LogLevel.DEBUG, operation, message, { context });
  }

  /** Log at INFO level. */
  info(
    operation: string,
    message: string,
    options?: { context?: Readonly<Record<string, unknown>>; duration_ms?: number },
  ): void {
    this.log(LogLevel.INFO, operation, message, options);
  }

  /** Log at WARN level. */
  warn(
    operation: string,
    message: string,
    options?: { context?: Readonly<Record<string, unknown>>; error?: unknown },
  ): void {
    this.log(LogLevel.WARN, operation, message, options);
  }

  /** Log at ERROR level. */
  error(
    operation: string,
    message: string,
    options?: {
      context?: Readonly<Record<string, unknown>>;
      error?: unknown;
      duration_ms?: number;
    },
  ): void {
    this.log(LogLevel.ERROR, operation, message, options);
  }

  private log(
    level: LogLevel,
    operation: string,
    message: string,
    options?: {
      context?: Readonly<Record<string, unknown>>;
      error?: unknown;
      duration_ms?: number;
    },
  ): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      operation,
      message,
      ...(options?.context ? { context: options.context } : {}),
      ...(options?.error ? { error: serializeError(options.error) } : {}),
      ...(options?.duration_ms !== undefined ? { duration_ms: options.duration_ms } : {}),
    };

    this.writer(JSON.stringify(entry));
  }
}

/**
 * Serialize an unknown error value into a structured log-safe object.
 */
function serializeError(
  err: unknown,
): { code: string; message: string; stack?: string; cause?: string } {
  if (err instanceof Error) {
    const code =
      'code' in err && typeof (err as Record<string, unknown>)['code'] === 'string'
        ? ((err as Record<string, unknown>)['code'] as string)
        : err.name;
    return {
      code,
      message: err.message,
      stack: err.stack,
      cause: err.cause instanceof Error ? err.cause.message : undefined,
    };
  }
  return { code: 'UNKNOWN', message: String(err) };
}
