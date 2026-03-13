'use client';

import dynamic from 'next/dynamic';

/**
 * Wallet connect/disconnect button using Solana wallet adapter.
 * Dynamically imported to avoid SSR issues with wallet adapter.
 */
const WalletMultiButtonDynamic = dynamic(
  async () => {
    const { WalletMultiButton } = await import('@solana/wallet-adapter-react-ui');
    return WalletMultiButton;
  },
  { ssr: false },
);

export function WalletButton(): React.JSX.Element {
  return <WalletMultiButtonDynamic data-testid="wallet-button" />;
}
