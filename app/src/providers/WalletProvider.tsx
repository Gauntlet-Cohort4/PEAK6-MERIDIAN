'use client';

import React from 'react';

interface WalletProviderProps {
  readonly children: React.ReactNode;
}

/**
 * Wallet context provider.
 * Stage A: passthrough wrapper. Stage B will integrate @solana/react-hooks.
 */
export function WalletProvider({ children }: WalletProviderProps) {
  return <>{children}</>;
}
