'use client';

import { useTradeHistory } from '@/hooks/useTradeHistory';
import type { TradeHistoryEntry } from '@/hooks/useTradeHistory';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { cn } from '@/lib/cn';

function formatTimestamp(ts: number): string {
  if (ts === 0) return 'Unknown';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function shortenSignature(sig: string): string {
  if (sig.length <= 16) return sig;
  return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
}

function getTypeBadgeClasses(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('buy')) return 'bg-[#00d26a20] text-[#00d26a] border-[#00d26a40]';
  if (lower.includes('sell')) return 'bg-[#ff3b6920] text-[#ff3b69] border-[#ff3b6940]';
  if (lower.includes('redeem')) return 'bg-[#3b82f620] text-[#3b82f6] border-[#3b82f640]';
  return 'bg-[#111827] text-[#64748b] border-[#1e2a3a]';
}

function HistoryRow({ entry, isEven }: { readonly entry: TradeHistoryEntry; readonly isEven: boolean }) {
  const isDemoTx = entry.signature.startsWith('demo_');

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 text-xs',
        isEven ? 'bg-[#111827]' : 'bg-[#0d1117]',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold', getTypeBadgeClasses(entry.type))}>
          {entry.type}
        </span>
        <Badge
          variant={entry.status === 'success' ? 'yes' : 'destructive'}
          className="text-[10px] px-1.5 py-0"
        >
          {entry.status === 'success' ? 'OK' : 'Fail'}
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-[#64748b]">
          {formatTimestamp(entry.timestamp)}
        </span>
        {isDemoTx ? (
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#f59e0b] border border-[#f59e0b]/30 rounded-sm px-1 py-0">
              Demo
            </span>
            <span className="font-mono text-[#64748b]">
              {shortenSignature(entry.signature)}
            </span>
          </span>
        ) : (
          <a
            href={getExplorerUrl(entry.signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[#3b82f6] hover:underline"
          >
            {shortenSignature(entry.signature)}
          </a>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { history, isLoading, error } = useTradeHistory();

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#e2e8f0] mb-6">Trade History</h1>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <p className="text-center text-[#ff3b69] py-8 text-sm">
            Failed to load history: {error}
          </p>
        ) : history.length === 0 ? (
          <p className="text-center text-[#64748b] py-16 text-sm">
            No trade history yet. Make a trade to see it here.
          </p>
        ) : (
          <div className="rounded-md border border-[#1e2a3a] overflow-hidden">
            {/* Table header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0a0e17] border-b border-[#1e2a3a]">
              <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">Type / Status</span>
              <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">Time / Tx</span>
            </div>
            {history.map((entry, i) => (
              <HistoryRow key={entry.signature} entry={entry} isEven={i % 2 === 0} />
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
