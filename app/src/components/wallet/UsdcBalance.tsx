'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { deriveAta, USDC_MINT } from '@/lib/tx/program';
import { IS_DEMO_MODE } from '@/lib/demo';
import { useDemoState } from '@/providers/DemoStateProvider';

/** Get the RPC connection URL from environment or default to devnet. */
function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
}

/** Format a number as USD with commas and 2 decimal places. */
function formatBalance(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Displays the connected wallet's USDC balance.
 * Shows nothing when wallet is not connected.
 * In demo mode, shows a fixed $10,000.00 balance.
 */
export function UsdcBalance() {
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const connectionRef = useRef<Connection | null>(null);
  const { state: demoState } = useDemoState();

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setBalance(demoState.balance);
      return;
    }

    if (!publicKey) {
      setBalance(null);
      return;
    }

    // Lazily create connection inside React lifecycle, not at module scope
    if (!connectionRef.current) {
      connectionRef.current = new Connection(getRpcUrl(), 'confirmed');
    }
    const connection = connectionRef.current;

    let cancelled = false;

    async function fetchBalance() {
      try {
        const ata = deriveAta(publicKey!, USDC_MINT);
        const response = await connection!.getTokenAccountBalance(ata);
        if (!cancelled) {
          setBalance(response.value.uiAmount ?? 0);
        }
      } catch {
        // ATA doesn't exist or RPC error — show $0.00
        if (!cancelled) {
          setBalance(0);
        }
      }
    }

    fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [publicKey, demoState.balance]);

  // Show nothing when wallet is not connected and not in demo mode
  if (balance === null) {
    return null;
  }

  return (
    <span
      className="text-sm font-mono font-medium text-muted-foreground"
      data-testid="usdc-balance"
    >
      {formatBalance(balance)} USDC
    </span>
  );
}
