'use client';

import { Badge } from '@/components/ui/badge';
import { TradeSide } from '@meridian/shared/types';
import type { Position } from '@meridian/shared/types';
import { getAvailableTrades } from '@/lib/position-constraints';
import { AlertCircle } from 'lucide-react';

interface PositionConstraintsProps {
  readonly position: Position | null;
  readonly selectedSide: TradeSide;
}

function sideLabel(side: TradeSide): string {
  return side.replace(/_/g, ' ');
}

export function PositionConstraints({
  position,
  selectedSide,
}: PositionConstraintsProps) {
  const { availableSides, holdingYes, holdingNo } =
    getAvailableTrades(position);
  const isAllowed = availableSides.includes(selectedSide);

  if (isAllowed) {
    return null;
  }

  const holdingSide = holdingYes ? 'Yes' : holdingNo ? 'No' : null;

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/5"
      data-testid="position-constraint-warning"
    >
      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-destructive">
          {sideLabel(selectedSide)} is not available
        </p>
        {holdingSide && (
          <p className="text-muted-foreground">
            You are holding {holdingSide} tokens. Close your position first.
          </p>
        )}
      </div>
    </div>
  );
}
