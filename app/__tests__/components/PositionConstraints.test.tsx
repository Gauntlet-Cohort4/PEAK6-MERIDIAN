import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositionConstraints } from '../../src/components/trade/PositionConstraints';
import { TradeSide } from '@meridian/shared/types';
import type { Position } from '@meridian/shared/types';

const makePosition = (
  yesBalance: number,
  noBalance: number,
): Position => ({
  marketAddress: 'test',
  ticker: 'AAPL',
  strikePrice: 230,
  yesTokenBalance: yesBalance,
  noTokenBalance: noBalance,
  avgEntryPrice: 0.5,
  unrealizedPnl: 0,
});

describe('PositionConstraints Component', () => {
  describe('No position (null)', () => {
    it('shows no warning for BUY_YES', () => {
      const { container } = render(
        <PositionConstraints position={null} selectedSide={TradeSide.BUY_YES} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });

    it('shows no warning for BUY_NO', () => {
      render(
        <PositionConstraints position={null} selectedSide={TradeSide.BUY_NO} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });
  });

  describe('Holding Yes tokens', () => {
    const yesPosition = makePosition(10, 0);

    it('allows BUY_YES — no warning', () => {
      render(
        <PositionConstraints position={yesPosition} selectedSide={TradeSide.BUY_YES} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });

    it('allows SELL_YES — no warning', () => {
      render(
        <PositionConstraints position={yesPosition} selectedSide={TradeSide.SELL_YES} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });

    it('blocks BUY_NO — shows warning', () => {
      render(
        <PositionConstraints position={yesPosition} selectedSide={TradeSide.BUY_NO} />,
      );
      const warning = screen.getByTestId('position-constraint-warning');
      expect(warning).toBeInTheDocument();
      expect(screen.getByText(/BUY NO is not available/)).toBeInTheDocument();
    });

    it('blocks SELL_NO — shows warning', () => {
      render(
        <PositionConstraints position={yesPosition} selectedSide={TradeSide.SELL_NO} />,
      );
      expect(screen.getByTestId('position-constraint-warning')).toBeInTheDocument();
      expect(screen.getByText(/SELL NO is not available/)).toBeInTheDocument();
    });

    it('shows "holding Yes tokens" message when blocked', () => {
      render(
        <PositionConstraints position={yesPosition} selectedSide={TradeSide.BUY_NO} />,
      );
      expect(screen.getByText(/You are holding Yes tokens/)).toBeInTheDocument();
      expect(screen.getByText(/Close your position first/)).toBeInTheDocument();
    });
  });

  describe('Holding No tokens', () => {
    const noPosition = makePosition(0, 15);

    it('allows BUY_NO — no warning', () => {
      render(
        <PositionConstraints position={noPosition} selectedSide={TradeSide.BUY_NO} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });

    it('allows SELL_NO — no warning', () => {
      render(
        <PositionConstraints position={noPosition} selectedSide={TradeSide.SELL_NO} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });

    it('blocks BUY_YES — shows warning', () => {
      render(
        <PositionConstraints position={noPosition} selectedSide={TradeSide.BUY_YES} />,
      );
      expect(screen.getByTestId('position-constraint-warning')).toBeInTheDocument();
      expect(screen.getByText(/BUY YES is not available/)).toBeInTheDocument();
    });

    it('blocks SELL_YES — shows warning', () => {
      render(
        <PositionConstraints position={noPosition} selectedSide={TradeSide.SELL_YES} />,
      );
      expect(screen.getByTestId('position-constraint-warning')).toBeInTheDocument();
    });

    it('shows "holding No tokens" message when blocked', () => {
      render(
        <PositionConstraints position={noPosition} selectedSide={TradeSide.BUY_YES} />,
      );
      expect(screen.getByText(/You are holding No tokens/)).toBeInTheDocument();
    });
  });

  describe('Zero balances (flat position)', () => {
    const flatPosition = makePosition(0, 0);

    it('allows BUY_YES — no warning', () => {
      render(
        <PositionConstraints position={flatPosition} selectedSide={TradeSide.BUY_YES} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });

    it('allows BUY_NO — no warning', () => {
      render(
        <PositionConstraints position={flatPosition} selectedSide={TradeSide.BUY_NO} />,
      );
      expect(screen.queryByTestId('position-constraint-warning')).not.toBeInTheDocument();
    });
  });
});
