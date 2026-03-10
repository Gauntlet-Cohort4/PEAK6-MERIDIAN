/**
 * Tests for strike price calculation.
 */

import { describe, it, expect } from 'vitest';
import { calculateStrikes, validateStrikes } from '../src/services/strike-calculator.js';

describe('calculateStrikes', () => {
  it('should generate 7 unique strikes for a typical price', () => {
    const strikes = calculateStrikes(185.50);
    expect(strikes.length).toBe(7);
  });

  it('should round to nearest $10 before computing offsets', () => {
    // 185.50 rounds to 190
    const strikes = calculateStrikes(185.50);
    expect(strikes).toContain(190); // center strike
  });

  it('should generate symmetric offsets at 3%, 6%, 9%', () => {
    // 200 rounds to 200
    const strikes = calculateStrikes(200);
    // 200 * 0.91 = 182, 200 * 0.94 = 188, 200 * 0.97 = 194
    // 200, 200 * 1.03 = 206, 200 * 1.06 = 212, 200 * 1.09 = 218
    expect(strikes).toEqual([182, 188, 194, 200, 206, 212, 218]);
  });

  it('should sort strikes ascending', () => {
    const strikes = calculateStrikes(500);
    for (let i = 1; i < strikes.length; i++) {
      expect(strikes[i]!).toBeGreaterThan(strikes[i - 1]!);
    }
  });

  it('should work with a high stock price (e.g., NVDA ~900)', () => {
    const strikes = calculateStrikes(875.60);
    // 875.60 rounds to 880
    expect(strikes).toContain(880);
    expect(strikes.length).toBe(7);
    // Check bounds: 880 * 0.91 = 801, 880 * 1.09 = 959
    expect(strikes[0]).toBe(Math.round(880 * 0.91));
    expect(strikes[strikes.length - 1]).toBe(Math.round(880 * 1.09));
  });

  it('should work with a low stock price (e.g., ~$10)', () => {
    const strikes = calculateStrikes(12);
    // 12 rounds to 10
    expect(strikes).toContain(10);
    expect(strikes.length).toBeLessThanOrEqual(7);
    expect(strikes.every((s) => s > 0)).toBe(true);
  });

  it('should handle a price that rounds exactly (e.g., $500)', () => {
    const strikes = calculateStrikes(500);
    expect(strikes).toContain(500);
    expect(strikes.length).toBe(7);
  });

  it('should throw for zero price', () => {
    expect(() => calculateStrikes(0)).toThrow('Invalid close price');
  });

  it('should throw for negative price', () => {
    expect(() => calculateStrikes(-100)).toThrow('Invalid close price');
  });

  it('should return a frozen array', () => {
    const strikes = calculateStrikes(200);
    expect(Object.isFrozen(strikes)).toBe(true);
  });

  it('should deduplicate strikes', () => {
    const strikes = calculateStrikes(200);
    const unique = new Set(strikes);
    expect(unique.size).toBe(strikes.length);
  });
});

describe('validateStrikes', () => {
  it('should return true for valid strikes', () => {
    expect(validateStrikes([182, 188, 194, 200, 206, 212, 218])).toBe(true);
  });

  it('should return false for empty array', () => {
    expect(validateStrikes([])).toBe(false);
  });

  it('should return false if any strike is zero', () => {
    expect(validateStrikes([0, 100, 200])).toBe(false);
  });

  it('should return false if any strike is negative', () => {
    expect(validateStrikes([-10, 100, 200])).toBe(false);
  });

  it('should return false if not sorted ascending', () => {
    expect(validateStrikes([200, 100, 300])).toBe(false);
  });

  it('should return false if duplicates exist', () => {
    expect(validateStrikes([100, 100, 200])).toBe(false);
  });
});
