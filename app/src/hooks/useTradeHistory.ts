'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { MERIDIAN_PROGRAM_ID } from '@/lib/idl';
import { IS_DEMO_MODE } from '@/lib/demo';

export interface TradeHistoryEntry {
  readonly signature: string;
  readonly timestamp: number;
  readonly status: 'success' | 'failed';
  readonly type: string;
  readonly slot: number;
}

export interface UseTradeHistoryResult {
  readonly history: readonly TradeHistoryEntry[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

/** Known instruction discriminators from the Meridian program. */
const DISCRIMINATORS: Record<string, string> = {
  '13955e6eb5ba216b': 'Mint Pair',
  'b80c569546c461e1': 'Redeem',
  '48ac18dcb0b50dd9': 'Buy No (Market)',
  'bdc2842a50f99a67': 'Sell No',
};

function getRpcUrl(): string {
  return (
    (typeof process !== 'undefined'
      ? process.env?.['NEXT_PUBLIC_SOLANA_RPC_URL']
      : undefined) ?? 'https://api.devnet.solana.com'
  );
}

/** Shared connection singleton. */
let _conn: Connection | null = null;
let _connUrl: string | null = null;

function getConnection(): Connection {
  const url = getRpcUrl();
  if (_conn !== null && _connUrl === url) return _conn;
  _conn = new Connection(url, 'confirmed');
  _connUrl = url;
  return _conn;
}

/** Mock history for demo mode. */
const MOCK_HISTORY: readonly TradeHistoryEntry[] = [
  {
    signature: 'demo_tx_abc123def456',
    timestamp: Date.now() - 3600 * 1000,
    status: 'success',
    type: 'Mint Pair',
    slot: 12345678,
  },
  {
    signature: 'demo_tx_ghi789jkl012',
    timestamp: Date.now() - 7200 * 1000,
    status: 'success',
    type: 'Redeem',
    slot: 12345600,
  },
  {
    signature: 'demo_tx_mno345pqr678',
    timestamp: Date.now() - 10800 * 1000,
    status: 'success',
    type: 'Mint Pair',
    slot: 12345500,
  },
];

/**
 * Try to determine the instruction type from transaction data.
 * Parses the first 8 bytes (discriminator) of program instructions.
 */
function detectInstructionType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
): string {
  try {
    const message = tx?.transaction?.message;
    if (!message) return 'Unknown';

    const programIdStr = MERIDIAN_PROGRAM_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountKeys = message.accountKeys?.map((k: any) =>
      k.toBase58?.() ?? k.toString(),
    ) ?? [];

    for (const ix of message.instructions ?? []) {
      const progIdx = ix.programIdIndex;
      if (accountKeys[progIdx] === programIdStr) {
        const data = ix.data;
        if (data && data.length >= 8) {
          const discHex = Buffer.from(data.slice(0, 8)).toString('hex');
          return DISCRIMINATORS[discHex] ?? 'Unknown';
        }
      }
    }

    // Check inner instructions for CPI interactions
    const meta = tx?.meta;
    if (meta?.innerInstructions) {
      for (const inner of meta.innerInstructions) {
        for (const ix of inner.instructions ?? []) {
          const progIdx = ix.programIdIndex;
          if (accountKeys[progIdx] === programIdStr) {
            return 'Program Interaction';
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return 'Unknown';
}

export function useTradeHistory(): UseTradeHistoryResult {
  const [history, setHistory] = useState<readonly TradeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { publicKey } = useWallet();

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setHistory(MOCK_HISTORY);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!publicKey) {
      setHistory([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const connection = getConnection();
        const programId = new PublicKey(MERIDIAN_PROGRAM_ID);

        // Fetch recent signatures for the wallet
        const signatures = await connection.getSignaturesForAddress(
          publicKey!,
          { limit: 50 },
          'confirmed',
        );

        if (cancelled) return;

        const entries: TradeHistoryEntry[] = [];

        // Process in batches of 10 to avoid rate limits
        const BATCH_SIZE = 10;
        for (let i = 0; i < Math.min(signatures.length, 50); i += BATCH_SIZE) {
          const batch = signatures.slice(i, i + BATCH_SIZE);
          const txDetails = await Promise.all(
            batch.map((sig) =>
              connection
                .getTransaction(sig.signature, {
                  maxSupportedTransactionVersion: 0,
                })
                .catch(() => null),
            ),
          );

          if (cancelled) return;

          for (let j = 0; j < batch.length; j++) {
            const sig = batch[j];
            const tx = txDetails[j];

            if (!tx) continue;

            // Check if this transaction involves our program
            const accountKeys =
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (tx.transaction.message as any).getAccountKeys?.() ??
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (tx.transaction.message as any).accountKeys ??
              [];

            const involvesMeridian = Array.from(accountKeys).some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (key: any) => {
                const keyStr = key.toBase58?.() ?? key.toString();
                return keyStr === programId.toBase58();
              },
            );

            if (!involvesMeridian) continue;

            const type = detectInstructionType(tx);

            entries.push({
              signature: sig.signature,
              timestamp: (sig.blockTime ?? 0) * 1000,
              status: sig.err ? 'failed' : 'success',
              type,
              slot: sig.slot,
            });
          }
        }

        if (cancelled) return;
        setHistory(entries);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to fetch history';
        console.error('useTradeHistory: fetch failed', err);
        setError(message);
        setHistory([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  return { history, isLoading, error };
}
