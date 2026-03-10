import { describe, it, expect } from 'vitest';
import { formatUSD, formatPercent, formatPrice, truncateAddress } from '../../src/lib/format';

describe('formatUSD', () => {
  it('formats positive values', () => {
    expect(formatUSD(0.65)).toBe('$0.65');
  });

  it('formats zero', () => {
    expect(formatUSD(0)).toBe('$0.00');
  });

  it('formats large values', () => {
    expect(formatUSD(1234.5)).toBe('$1,234.50');
  });

  it('formats negative values', () => {
    expect(formatUSD(-5.5)).toBe('-$5.50');
  });
});

describe('formatPercent', () => {
  it('formats decimal as percentage', () => {
    expect(formatPercent(0.65)).toBe('65.0%');
  });

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats 100%', () => {
    expect(formatPercent(1)).toBe('100.0%');
  });
});

describe('formatPrice', () => {
  it('formats to 2 decimal places', () => {
    expect(formatPrice(0.65)).toBe('0.65');
  });

  it('pads short decimals', () => {
    expect(formatPrice(0.5)).toBe('0.50');
  });

  it('truncates long decimals', () => {
    expect(formatPrice(0.6543)).toBe('0.65');
  });
});

describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    const addr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    expect(truncateAddress(addr)).toBe('7xKX...gAsU');
  });

  it('uses custom char count', () => {
    const addr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    expect(truncateAddress(addr, 6)).toBe('7xKXtg...osgAsU');
  });

  it('returns short strings unchanged', () => {
    expect(truncateAddress('abc')).toBe('abc');
  });
});
