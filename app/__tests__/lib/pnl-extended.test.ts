import { describe, it, expect } from 'vitest';
import { calculatePnl } from '../../src/lib/pnl';

describe('P&L Accuracy - Extended Coverage', () => {
  describe('Standard cases', () => {
    it('calculates positive P&L for profitable position', () => {
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

    it('calculates negative P&L for losing position', () => {
      const result = calculatePnl({
        quantity: 10,
        avgEntryPrice: 0.70,
        currentPrice: 0.50,
      });
      expect(result.pnl).toBeCloseTo(-2.00, 2);
      expect(result.pnlPercent).toBeCloseTo(-0.2857, 3);
      expect(result.costBasis).toBeCloseTo(7.00, 2);
      expect(result.marketValue).toBeCloseTo(5.00, 2);
    });

    it('calculates breakeven P&L', () => {
      const result = calculatePnl({
        quantity: 10,
        avgEntryPrice: 0.50,
        currentPrice: 0.50,
      });
      expect(result.pnl).toBeCloseTo(0, 2);
      expect(result.pnlPercent).toBeCloseTo(0, 2);
    });
  });

  describe('Zero and edge cases', () => {
    it('returns zeros for zero quantity', () => {
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

    it('handles 100% profit (price doubles)', () => {
      const result = calculatePnl({
        quantity: 20,
        avgEntryPrice: 0.25,
        currentPrice: 0.50,
      });
      expect(result.pnl).toBeCloseTo(5.00, 2);
      expect(result.pnlPercent).toBeCloseTo(1.0, 2); // 100%
    });

    it('handles max payout scenario (binary option at 1.00)', () => {
      const result = calculatePnl({
        quantity: 10,
        avgEntryPrice: 0.60,
        currentPrice: 1.00,
      });
      expect(result.pnl).toBeCloseTo(4.00, 2);
      expect(result.marketValue).toBeCloseTo(10.00, 2);
    });

    it('handles worthless outcome (price drops to 0)', () => {
      const result = calculatePnl({
        quantity: 10,
        avgEntryPrice: 0.60,
        currentPrice: 0.00,
      });
      expect(result.pnl).toBeCloseTo(-6.00, 2);
      expect(result.pnlPercent).toBeCloseTo(-1.0, 2); // -100%
      expect(result.marketValue).toBe(0);
    });
  });

  describe('Binary options specific P&L scenarios', () => {
    it('Yes winner: bought at 0.40, settled at 1.00', () => {
      const result = calculatePnl({
        quantity: 25,
        avgEntryPrice: 0.40,
        currentPrice: 1.00,
      });
      // Cost basis: 25 * 0.40 = 10.00
      // Market value: 25 * 1.00 = 25.00
      // P&L: 15.00
      expect(result.costBasis).toBeCloseTo(10.00, 2);
      expect(result.marketValue).toBeCloseTo(25.00, 2);
      expect(result.pnl).toBeCloseTo(15.00, 2);
      expect(result.pnlPercent).toBeCloseTo(1.50, 2); // 150%
    });

    it('Yes loser: bought at 0.70, settled at 0.00', () => {
      const result = calculatePnl({
        quantity: 15,
        avgEntryPrice: 0.70,
        currentPrice: 0.00,
      });
      // Cost basis: 15 * 0.70 = 10.50
      // Market value: 0
      // P&L: -10.50
      expect(result.costBasis).toBeCloseTo(10.50, 2);
      expect(result.marketValue).toBe(0);
      expect(result.pnl).toBeCloseTo(-10.50, 2);
      expect(result.pnlPercent).toBeCloseTo(-1.0, 2); // -100%
    });

    it('No winner: bought No at 0.35, No wins (price=1.00)', () => {
      const result = calculatePnl({
        quantity: 20,
        avgEntryPrice: 0.35,
        currentPrice: 1.00,
      });
      // Cost basis: 20 * 0.35 = 7.00
      // Market value: 20 * 1.00 = 20.00
      // P&L: 13.00
      expect(result.pnl).toBeCloseTo(13.00, 2);
      expect(result.pnlPercent).toBeCloseTo(13.0 / 7.0, 2);
    });

    it('Small position with precise arithmetic', () => {
      const result = calculatePnl({
        quantity: 1,
        avgEntryPrice: 0.55,
        currentPrice: 0.62,
      });
      expect(result.costBasis).toBeCloseTo(0.55, 4);
      expect(result.marketValue).toBeCloseTo(0.62, 4);
      expect(result.pnl).toBeCloseTo(0.07, 4);
    });

    it('Large position P&L scales linearly', () => {
      const small = calculatePnl({
        quantity: 1,
        avgEntryPrice: 0.50,
        currentPrice: 0.75,
      });
      const large = calculatePnl({
        quantity: 100,
        avgEntryPrice: 0.50,
        currentPrice: 0.75,
      });
      expect(large.pnl).toBeCloseTo(small.pnl * 100, 2);
      expect(large.pnlPercent).toBeCloseTo(small.pnlPercent, 4);
    });
  });

  describe('Mock position P&L matches expected values', () => {
    it('AAPL 230 Yes position P&L with current price at 0.65', () => {
      // Mock position: qty=25, avgEntry=0.60
      const result = calculatePnl({
        quantity: 25,
        avgEntryPrice: 0.60,
        currentPrice: 0.65,
      });
      expect(result.costBasis).toBeCloseTo(15.00, 2);
      expect(result.marketValue).toBeCloseTo(16.25, 2);
      expect(result.pnl).toBeCloseTo(1.25, 2);
    });

    it('NVDA 140 No position P&L with current price at 0.45', () => {
      // Mock position: qty=15 (No tokens), avgEntry=0.40
      const result = calculatePnl({
        quantity: 15,
        avgEntryPrice: 0.40,
        currentPrice: 0.45,
      });
      expect(result.costBasis).toBeCloseTo(6.00, 2);
      expect(result.marketValue).toBeCloseTo(6.75, 2);
      expect(result.pnl).toBeCloseTo(0.75, 2);
    });
  });
});
