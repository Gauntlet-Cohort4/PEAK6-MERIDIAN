import { describe, it, expect } from 'vitest';
import { DEBUG_FLAGS, debugLog } from '../debug.js';
import type { DebugFlagKey } from '../debug.js';

describe('DEBUG_FLAGS', () => {
  it('should have all expected flag keys', () => {
    const keys: DebugFlagKey[] = [
      'PHOENIX_INTEROP',
      'ADAPTER_CALLS',
      'TX_BUILDING',
      'ORACLE_READS',
      'CRON_JOBS',
      'ORDER_BOOK',
      'ALL',
    ];
    for (const key of keys) {
      expect(key in DEBUG_FLAGS).toBe(true);
    }
  });

  it('should default all flags to false when env is not set', () => {
    // In test environment, none of MERIDIAN_DEBUG_* should be 'true'
    for (const value of Object.values(DEBUG_FLAGS)) {
      expect(value).toBe(false);
    }
  });
});

describe('debugLog', () => {
  it('should not throw when called with flags disabled', () => {
    expect(() => {
      debugLog('PHOENIX_INTEROP', 'test', 'op', 'message');
    }).not.toThrow();
  });

  it('should accept optional context parameter', () => {
    expect(() => {
      debugLog('ADAPTER_CALLS', 'test', 'op', 'msg', { key: 'val' });
    }).not.toThrow();
  });
});
