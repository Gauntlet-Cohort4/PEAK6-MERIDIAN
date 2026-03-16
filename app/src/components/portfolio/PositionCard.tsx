'use client';

import { memo } from 'react';
import { MarketStatus, TradeSide } from '@meridian/shared/types';
import type { Position, StrikeMarket } from '@meridian/shared/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatUSD, formatPrice } from '@/lib/format';
import { cn } from '@/lib/cn';
import Link from 'next/link';

/**
 * Determine if a position's tokens are winners based on settlement.
 * Returns: 'yes_wins' | 'no_wins' | null (if not settled)
 */
function getSettlementOutcome(
  market: StrikeMarket | undefined,
): 'yes_wins' | 'no_wins' | null {
  if (
    !market ||
    market.status !== MarketStatus.SETTLED ||
    market.settlementPrice === null
  ) {
    return null;
  }
  return market.settlementPrice >= market.strikePrice ? 'yes_wins' : 'no_wins';
}

/**
 * Check if the user holds winning tokens for a settled market.
 */
function isWinningPosition(
  pos: Position,
  outcome: 'yes_wins' | 'no_wins',
): boolean {
  if (outcome === 'yes_wins') return pos.yesTokenBalance > 0;
  return pos.noTokenBalance > 0;
}

function getWinningAmount(
  pos: Position,
  outcome: 'yes_wins' | 'no_wins',
): number {
  if (outcome === 'yes_wins') return pos.yesTokenBalance;
  return pos.noTokenBalance;
}

function getRedeemSide(outcome: 'yes_wins' | 'no_wins'): TradeSide {
  return outcome === 'yes_wins' ? TradeSide.REDEEM_YES : TradeSide.REDEEM_NO;
}

export interface PositionCardProps {
  readonly pos: Position;
  readonly market: StrikeMarket | undefined;
  readonly onRedeem?: (
    marketAddress: string,
    side: TradeSide,
    amount: number,
  ) => void;
  readonly isRedeeming?: boolean;
}

export const PositionCard = memo(function PositionCard({ pos, market, onRedeem, isRedeeming }: PositionCardProps) {
  const isYes = pos.yesTokenBalance > 0;
  const quantity = isYes ? pos.yesTokenBalance : pos.noTokenBalance;
  const outcome = getSettlementOutcome(market);
  const isSettled = outcome !== null;
  const isWinner = outcome !== null && isWinningPosition(pos, outcome);
  const payout = isWinner ? getWinningAmount(pos, outcome) : 0;

  return (
    <div
      className={cn(
        'bg-[#111827] border border-[#1e2a3a] rounded-md p-3',
        'border-l-[3px]',
        isYes ? 'border-l-[#00d26a]' : 'border-l-[#ff3b69]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-[#e2e8f0]">{pos.ticker}</span>
        <div className="flex items-center gap-1.5">
          <Badge variant={isYes ? 'yes' : 'no'}>
            {isYes ? 'Yes' : 'No'}
          </Badge>
          {isSettled && (
            <Badge variant={isWinner ? 'yes' : 'destructive'}>
              {isWinner ? 'Winner' : 'Lost'}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-[10px] text-[#64748b] mb-1 font-mono">
        Strike: {formatUSD(pos.strikePrice)}
      </p>
      {isSettled &&
        market?.settlementPrice !== null &&
        market?.settlementPrice !== undefined && (
          <p className="text-[10px] text-[#64748b] mb-2 font-mono">
            Settled at: {formatUSD(market.settlementPrice)}
          </p>
        )}

      {/* Stats */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[#64748b]">Qty</span>
          <span className="font-mono text-[#e2e8f0]">{quantity}</span>
        </div>
        {pos.avgEntryPrice > 0 ? (
          <div className="flex justify-between">
            <span className="text-[#64748b]">Avg Entry</span>
            <span className="font-mono text-[#e2e8f0]">{formatPrice(pos.avgEntryPrice)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-[#64748b]">Avg Entry</span>
            <span className="font-mono text-[#64748b]">N/A</span>
          </div>
        )}
        {isSettled ? (
          <div className="flex justify-between">
            <span className="text-[#64748b]">Payout</span>
            <span
              className={cn(
                'font-mono font-medium',
                isWinner ? 'text-[#00d26a]' : 'text-[#ff3b69]',
              )}
            >
              {isWinner ? formatUSD(payout) : '$0.00'}
            </span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-[#64748b]">Status</span>
            <span className="text-[#64748b]">Awaiting settlement</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isSettled && isWinner && onRedeem && outcome !== null ? (
        <Button
          size="sm"
          className="w-full mt-3 bg-[#00d26a] hover:bg-[#00d26a]/90 text-white font-semibold shadow-[0_0_12px_rgba(0,210,106,0.25)]"
          disabled={isRedeeming}
          onClick={() =>
            onRedeem(pos.marketAddress, getRedeemSide(outcome), payout)
          }
        >
          {isRedeeming ? 'Redeeming...' : `Redeem ${formatUSD(payout)} USDC`}
        </Button>
      ) : !isSettled ? (
        <Link href={`/trade/${pos.marketAddress}`}>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 border-[#1e2a3a] text-[#64748b] hover:text-[#e2e8f0] hover:border-[#3b82f6]/50"
          >
            Trade
          </Button>
        </Link>
      ) : null}
    </div>
  );
});
