'use client';

import { useSettlementTimer, type TimerStatus } from '@/hooks/useSettlementTimer';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SettlementTimerProps {
  readonly className?: string;
}

const statusColors: Record<TimerStatus, string> = {
  trading: 'text-yes',
  settling: 'text-yellow-600',
  closed: 'text-muted-foreground',
};

const statusBadges: Record<TimerStatus, string> = {
  trading: 'Trading',
  settling: 'Settling',
  closed: 'Closed',
};

export function SettlementTimer({ className }: SettlementTimerProps) {
  const { timeString, status } = useSettlementTimer();

  return (
    <div
      className={cn('flex items-center gap-2 text-sm', className)}
      data-testid="settlement-timer"
    >
      <Clock className={cn('h-4 w-4', statusColors[status])} />
      <Badge
        variant={status === 'trading' ? 'yes' : status === 'settling' ? 'warning' : 'secondary'}
      >
        {statusBadges[status]}
      </Badge>
      <span className={statusColors[status]}>{timeString}</span>
    </div>
  );
}
