import { describe, it, expect } from 'vitest';
import {
  calcImpliedProbability,
  isOneSidedBook,
} from '../../src/lib/implied-probability';

describe('calcImpliedProbability', () => {
  it('returns mid-price when both bid and ask exist', () => {
    expect(calcImpliedProbability(0.60, 0.70)).toBeCloseTo(0.65, 10);
  });

  it('returns bid when only bid exists', () => {
    expect(calcImpliedProbability(0.60, null)).toBe(0.60);
  });

  it('returns ask when only ask exists', () => {
    expect(calcImpliedProbability(null, 0.70)).toBe(0.70);
  });

  it('returns null when neither exists', () => {
    expect(calcImpliedProbability(null, null)).toBeNull();
  });

  it('handles zero values', () => {
    expect(calcImpliedProbability(0, 1)).toBe(0.5);
  });
});

describe('isOneSidedBook', () => {
  it('returns false when both sides exist', () => {
    expect(isOneSidedBook(0.60, 0.70)).toBe(false);
  });

  it('returns true when only bid exists', () => {
    expect(isOneSidedBook(0.60, null)).toBe(true);
  });

  it('returns true when only ask exists', () => {
    expect(isOneSidedBook(null, 0.70)).toBe(true);
  });

  it('returns false when neither exists', () => {
    expect(isOneSidedBook(null, null)).toBe(false);
  });
});
