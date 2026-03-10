import { describe, it, expect } from 'vitest';
import { Logger, LogLevel } from '../logger.js';
import type { LogEntry } from '../logger.js';

function createTestLogger(
  service: string,
  minLevel: LogLevel = LogLevel.DEBUG,
): { logger: Logger; output: string[] } {
  const output: string[] = [];
  const writer = (json: string): void => {
    output.push(json);
  };
  const logger = new Logger(service, { minLevel, writer });
  return { logger, output };
}

function parseEntry(json: string): LogEntry {
  return JSON.parse(json) as LogEntry;
}

function firstEntry(output: string[]): LogEntry {
  const first = output[0];
  if (first === undefined) {
    throw new Error('Expected at least one log entry');
  }
  return parseEntry(first);
}

describe('Logger', () => {
  it('should output structured JSON for info level', () => {
    const { logger, output } = createTestLogger('test-service');
    logger.info('startup', 'Service started');
    expect(output).toHaveLength(1);
    const entry = firstEntry(output);
    expect(entry.level).toBe('INFO');
    expect(entry.service).toBe('test-service');
    expect(entry.operation).toBe('startup');
    expect(entry.message).toBe('Service started');
    expect(entry.timestamp).toBeDefined();
  });

  it('should include context when provided', () => {
    const { logger, output } = createTestLogger('ctx-test');
    logger.info('op', 'msg', { context: { key: 'value' } });
    const entry = firstEntry(output);
    expect(entry.context).toEqual({ key: 'value' });
  });

  it('should include duration_ms when provided', () => {
    const { logger, output } = createTestLogger('dur-test');
    logger.info('op', 'msg', { duration_ms: 42 });
    const entry = firstEntry(output);
    expect(entry.duration_ms).toBe(42);
  });

  it('should serialize error objects', () => {
    const { logger, output } = createTestLogger('err-test');
    const err = new Error('something broke');
    logger.error('handle', 'Failed', { error: err });
    const entry = firstEntry(output);
    expect(entry.error?.message).toBe('something broke');
    expect(entry.error?.code).toBe('Error');
  });

  it('should respect minimum log level', () => {
    const { logger, output } = createTestLogger('level-test', LogLevel.WARN);
    logger.debug('op', 'debug msg');
    logger.info('op', 'info msg');
    logger.warn('op', 'warn msg');
    logger.error('op', 'error msg');
    expect(output).toHaveLength(2);
    const warnEntry = output[0] ? parseEntry(output[0]) : undefined;
    const errorEntry = output[1] ? parseEntry(output[1]) : undefined;
    expect(warnEntry?.level).toBe('WARN');
    expect(errorEntry?.level).toBe('ERROR');
  });

  it('should log at DEBUG level', () => {
    const { logger, output } = createTestLogger('debug-test');
    logger.debug('op', 'debug message', { flag: true });
    const entry = firstEntry(output);
    expect(entry.level).toBe('DEBUG');
  });

  it('should handle non-Error objects in error field', () => {
    const { logger, output } = createTestLogger('non-err');
    logger.error('op', 'msg', { error: 'string error' });
    const entry = firstEntry(output);
    expect(entry.error?.code).toBe('UNKNOWN');
    expect(entry.error?.message).toBe('string error');
  });
});
