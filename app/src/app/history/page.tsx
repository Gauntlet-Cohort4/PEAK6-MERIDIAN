'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUSD } from '@/lib/format';

/** Mock trade history for Stage A. */
const MOCK_HISTORY = [
  {
    id: '1',
    ticker: 'AAPL',
    side: 'BUY_YES',
    size: 10,
    price: 0.6,
    timestamp: Date.now() - 3600 * 1000,
    txSignature: 'mock_tx_abc123',
  },
  {
    id: '2',
    ticker: 'NVDA',
    side: 'BUY_NO',
    size: 5,
    price: 0.45,
    timestamp: Date.now() - 7200 * 1000,
    txSignature: 'mock_tx_def456',
  },
  {
    id: '3',
    ticker: 'TSLA',
    side: 'SELL_YES',
    size: 8,
    price: 0.72,
    timestamp: Date.now() - 10800 * 1000,
    txSignature: 'mock_tx_ghi789',
  },
] as const;

function sideLabel(side: string): string {
  return side.replace(/_/g, ' ');
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Trade History</h1>
        <p className="text-muted-foreground">Your past trades</p>
      </div>

      {MOCK_HISTORY.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          No trade history
        </p>
      ) : (
        <div className="space-y-3">
          {MOCK_HISTORY.map((trade) => (
            <Card key={trade.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{trade.ticker}</span>
                  <Badge
                    variant={
                      trade.side.includes('YES') ? 'yes' : 'no'
                    }
                  >
                    {sideLabel(trade.side)}
                  </Badge>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">
                    {trade.size} @ {trade.price.toFixed(2)}
                  </span>
                  <span className="font-mono">
                    {formatUSD(trade.size * trade.price)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatTimestamp(trade.timestamp)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
