'use client';

import { useTradeHistory } from '@/hooks/useTradeHistory';
import type { TradeHistoryEntry } from '@/hooks/useTradeHistory';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

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

function HistoryRow({ entry }: { readonly entry: TradeHistoryEntry }) {
  const isDemoTx = entry.signature.startsWith('demo_');

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Badge variant={entry.status === 'success' ? 'outline' : 'destructive'}>
            {entry.type}
          </Badge>
          <Badge variant={entry.status === 'success' ? 'yes' : 'destructive'}>
            {entry.status === 'success' ? 'Success' : 'Failed'}
          </Badge>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(entry.timestamp)}
          </span>
          {isDemoTx ? (
            <span className="font-mono text-xs text-muted-foreground">
              {shortenSignature(entry.signature)}
            </span>
          ) : (
            <a
              href={getExplorerUrl(entry.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary hover:underline"
            >
              {shortenSignature(entry.signature)}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const { history, isLoading, error } = useTradeHistory();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Trade History</h1>
        <p className="text-muted-foreground">
          Your Meridian transactions
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="text-center text-destructive py-8">
          Failed to load history: {error}
        </p>
      ) : history.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          No trade history yet. Make a trade to see it here.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <HistoryRow key={entry.signature} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
