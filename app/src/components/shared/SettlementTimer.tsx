'use client';

import { useSettlementTimer, type TimerStatus } from '@/hooks/useSettlementTimer';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SettlementTimerProps {
  readonly className?: string;
}

const statusColors: Record<TimerStatus, string> = {
  trading: 'text-[#00d26a]',
  settling: 'text-[#f59e0b]',
  closed: 'text-[#64748b]',
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
      className={cn('flex items-center gap-1.5 text-xs', className)}
      data-testid="settlement-timer"
    >
      <Clock className={cn('h-3 w-3', statusColors[status])} />
      <Badge
        variant={status === 'trading' ? 'yes' : status === 'settling' ? 'warning' : 'secondary'}
        className="text-[10px] px-1.5 py-0"
      >
        {statusBadges[status]}
      </Badge>
      <span className={cn('font-mono', statusColors[status])}>{timeString}</span>
    </div>
  );
}
