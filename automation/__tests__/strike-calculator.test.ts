/**
 * Tests for strike price calculation.
 */

import { describe, it, expect } from 'vitest';
import { calculateStrikes, validateStrikes } from '../src/services/strike-calculator.js';

describe('calculateStrikes', () => {
  it('should generate unique strikes for a typical price', () => {
    const strikes = calculateStrikes(185.50);
    // All strikes should be multiples of 10
    expect(strikes.every((s) => s % 10 === 0)).toBe(true);
    expect(strikes.length).toBeGreaterThanOrEqual(1);
    expect(strikes.length).toBeLessThanOrEqual(7);
  });

  it('should round center strike to nearest $10', () => {
    // 185.50 rounds to 190
    const strikes = calculateStrikes(185.50);
    expect(strikes).toContain(190); // center strike
  });

  it('should round ALL strikes to nearest $10', () => {
    // closePrice=500: offsets at 3/6/9% all rounded to $10
    // 500*0.91=455 -> 460, 500*0.94=470, 500*0.97=485 -> 490
    // 500, 500*1.03=515 -> 520, 500*1.06=530, 500*1.09=545 -> 550
    const strikes = calculateStrikes(500);
    expect(strikes).toEqual([460, 470, 490, 500, 520, 530, 550]);
  });

  it('should generate symmetric offsets at 3%, 6%, 9% with $10 rounding', () => {
    // closePrice=200: all offsets rounded to nearest $10
    // 200*0.91=182 -> 180, 200*0.94=188 -> 190, 200*0.97=194 -> 190 (dup)
    // 200, 200*1.03=206 -> 210, 200*1.06=212 -> 210 (dup), 200*1.09=218 -> 220
    const strikes = calculateStrikes(200);
    expect(strikes).toEqual([180, 190, 200, 210, 220]);
    expect(strikes.every((s) => s % 10 === 0)).toBe(true);
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
    // All strikes should be multiples of 10
    expect(strikes.every((s) => s % 10 === 0)).toBe(true);
    // 875.6*0.91=796.8 -> 800, 875.6*1.09=954.4 -> 950
    expect(strikes[0]).toBe(800);
    expect(strikes[strikes.length - 1]).toBe(950);
  });

  it('should work with a low stock price (e.g., ~$10)', () => {
    const strikes = calculateStrikes(12);
    // 12 rounds to 10, all offsets also round to 10
    expect(strikes).toContain(10);
    expect(strikes.every((s) => s > 0)).toBe(true);
    expect(strikes.every((s) => s % 10 === 0)).toBe(true);
  });

  it('should handle a price that rounds exactly (e.g., $500)', () => {
    const strikes = calculateStrikes(500);
    expect(strikes).toContain(500);
    expect(strikes.every((s) => s % 10 === 0)).toBe(true);
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
    expect(validateStrikes([180, 190, 200, 210, 220])).toBe(true);
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
