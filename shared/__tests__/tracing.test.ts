import { describe, it, expect } from 'vitest';
import { generateTraceId, startTrace, traceElapsed } from '../tracing.js';

describe('generateTraceId', () => {
  it('should return a string starting with mrd-', () => {
    const id = generateTraceId();
    expect(id).toMatch(/^mrd-\d+-[a-z0-9]+$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });
});

describe('startTrace', () => {
  it('should create a frozen trace context', () => {
    const trace = startTrace('test-operation');
    expect(trace.operation).toBe('test-operation');
    expect(trace.traceId).toMatch(/^mrd-/);
    expect(trace.startedAt).toBeGreaterThan(0);
    expect(trace.parentTraceId).toBeUndefined();
    expect(Object.isFrozen(trace)).toBe(true);
  });

  it('should accept a parent trace ID', () => {
    const parent = generateTraceId();
    const trace = startTrace('child-op', parent);
    expect(trace.parentTraceId).toBe(parent);
  });
});

describe('traceElapsed', () => {
  it('should return non-negative elapsed time', () => {
    const trace = startTrace('elapsed-test');
    const elapsed = traceElapsed(trace);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});
