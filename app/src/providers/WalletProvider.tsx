'use client';

import React, { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

import '@solana/wallet-adapter-react-ui/styles.css';

const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

interface WalletProviderProps {
  readonly children: React.ReactNode;
}

/**
 * Wallet context provider wrapping Solana wallet adapter for devnet.
 * Reads RPC URL from NEXT_PUBLIC_SOLANA_RPC_URL env var, defaults to devnet.
 */
export function WalletProvider({ children }: WalletProviderProps): React.JSX.Element {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? DEVNET_RPC_URL;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
