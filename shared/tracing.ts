/**
 * @module tracing
 * Lightweight operation tracing with correlation IDs.
 */

/**
 * Generate a unique trace ID for correlating log entries across
 * a single logical operation.
 *
 * Format: `mrd-<timestamp>-<random6>`
 */
export function generateTraceId(): string {
  return `mrd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Immutable context object that carries a trace ID through an operation. */
export interface TraceContext {
  readonly traceId: string;
  readonly startedAt: number;
  readonly operation: string;
  readonly parentTraceId?: string;
}

/**
 * Create a new trace context for an operation.
 * Returns a frozen object to prevent accidental mutation.
 */
export function startTrace(operation: string, parentTraceId?: string): Readonly<TraceContext> {
  return Object.freeze({
    traceId: generateTraceId(),
    startedAt: Date.now(),
    operation,
    parentTraceId,
  });
}

/**
 * Compute elapsed time in milliseconds since the trace started.
 */
export function traceElapsed(trace: Readonly<TraceContext>): number {
  return Date.now() - trace.startedAt;
}
