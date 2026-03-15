'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import type { Position } from '@meridian/shared/types';
import type { SupportedTicker } from '@meridian/shared/constants';
import { MERIDIAN_CONFIG } from '@meridian/shared/constants';
import { MOCK_POSITIONS } from '@/lib/mock-data';
import { useMarkets } from './useMarkets';
import { deriveAta } from '@/lib/tx/program';

/** Whether the app is running in demo mode. */
const IS_DEMO_MODE =
  typeof process !== 'undefined' &&
  process.env?.['NEXT_PUBLIC_DEMO_MODE'] === 'true';

export interface UsePositionsResult {
  readonly positions: readonly Position[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly getPosition: (marketAddress: string) => Position | null;
}

/** Get the RPC connection URL from environment or default to devnet. */
function getRpcUrl(): string {
  return (
    (typeof process !== 'undefined'
      ? process.env?.['NEXT_PUBLIC_SOLANA_RPC_URL']
      : undefined) ?? 'https://api.devnet.solana.com'
  );
}

/** Shared connection instance to avoid WebSocket handle leaks. */
let _sharedConnection: Connection | null = null;
let _sharedConnectionUrl: string | null = null;

function getSharedConnection(): Connection {
  const url = getRpcUrl();
  if (_sharedConnection !== null && _sharedConnectionUrl === url) {
    return _sharedConnection;
  }
  _sharedConnection = new Connection(url, 'confirmed');
  _sharedConnectionUrl = url;
  return _sharedConnection;
}

/**
 * Fetch the token balance for a given ATA address.
 * Returns 0 if the account does not exist.
 */
async function fetchTokenBalance(
  connection: Connection,
  ataAddress: PublicKey,
): Promise<number> {
  try {
    const response = await connection.getTokenAccountBalance(ataAddress);
    const amount = response.value.uiAmount;
    return amount ?? 0;
  } catch {
    // Account does not exist or other RPC error — treat as zero balance
    return 0;
  }
}

/**
 * Hook to fetch user positions.
 *
 * When wallet is connected and DEMO_MODE=false:
 *   reads real YES/NO token account balances from chain.
 * When wallet is disconnected or DEMO_MODE=true:
 *   returns MOCK_POSITIONS.
 */
export function usePositions(): UsePositionsResult {
  const [positions, setPositions] = useState<readonly Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { publicKey } = useWallet();
  const { markets } = useMarkets();

  useEffect(() => {
    // Demo mode or no wallet — use mock data
    if (IS_DEMO_MODE || !publicKey) {
      const timer = setTimeout(() => {
        setPositions(MOCK_POSITIONS);
        setIsLoading(false);
        setError(null);
      }, 300);
      return () => clearTimeout(timer);
    }

    // No markets loaded yet — wait
    if (markets.length === 0) {
      setPositions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPositions() {
      setIsLoading(true);
      setError(null);

      try {
        const connection = getSharedConnection();
        const walletPubkey = publicKey!;

        const positionResults = await Promise.all(
          markets.map(async (market) => {
            const yesMint = new PublicKey(market.yesTokenMint);
            const noMint = new PublicKey(market.noTokenMint);

            const yesAta = deriveAta(walletPubkey, yesMint);
            const noAta = deriveAta(walletPubkey, noMint);

            const [yesBalance, noBalance] = await Promise.all([
              fetchTokenBalance(connection, yesAta),
              fetchTokenBalance(connection, noAta),
            ]);

            // Only include markets where the user holds tokens
            if (yesBalance === 0 && noBalance === 0) {
              return null;
            }

            const position: Position = {
              marketAddress: market.address,
              ticker: market.ticker as SupportedTicker,
              strikePrice: market.strikePrice,
              yesTokenBalance: yesBalance,
              noTokenBalance: noBalance,
              // Cannot determine avg entry price from on-chain balance alone
              avgEntryPrice: 0,
              // Cannot compute PnL without trade history
              unrealizedPnl: 0,
            };

            return position;
          }),
        );

        if (cancelled) return;

        const filtered = positionResults.filter(
          (p): p is Position => p !== null,
        );
        setPositions(filtered);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to fetch positions';
        console.error('usePositions: fetch failed', err);
        setError(message);
        setPositions([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPositions();

    return () => {
      cancelled = true;
    };
  }, [publicKey, markets]);

  const getPosition = useCallback(
    (marketAddress: string): Position | null => {
      return positions.find((p) => p.marketAddress === marketAddress) ?? null;
    },
    [positions],
  );

  return { positions, isLoading, error, getPosition };
}
