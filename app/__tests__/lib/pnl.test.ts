import { describe, it, expect } from 'vitest';
import { calculatePnl } from '../../src/lib/pnl';

describe('calculatePnl', () => {
  it('calculates positive P&L', () => {
    const result = calculatePnl({
      quantity: 10,
      avgEntryPrice: 0.50,
      currentPrice: 0.65,
    });
    expect(result.pnl).toBeCloseTo(1.50, 2);
    expect(result.pnlPercent).toBeCloseTo(0.30, 2);
    expect(result.costBasis).toBeCloseTo(5.00, 2);
    expect(result.marketValue).toBeCloseTo(6.50, 2);
  });

  it('calculates negative P&L', () => {
    const result = calculatePnl({
      quantity: 10,
      avgEntryPrice: 0.70,
      currentPrice: 0.50,
    });
    expect(result.pnl).toBeCloseTo(-2.00, 2);
    expect(result.pnlPercent).toBeCloseTo(-0.2857, 3);
  });

  it('returns zero for zero quantity', () => {
    const result = calculatePnl({
      quantity: 0,
      avgEntryPrice: 0.50,
      currentPrice: 0.65,
    });
    expect(result.pnl).toBe(0);
    expect(result.pnlPercent).toBe(0);
    expect(result.costBasis).toBe(0);
    expect(result.marketValue).toBe(0);
  });

  it('handles breakeven', () => {
    const result = calculatePnl({
      quantity: 10,
      avgEntryPrice: 0.50,
      currentPrice: 0.50,
    });
    expect(result.pnl).toBeCloseTo(0, 2);
    expect(result.pnlPercent).toBeCloseTo(0, 2);
  });
});
