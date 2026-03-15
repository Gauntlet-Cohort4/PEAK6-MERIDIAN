'use client';

import dynamic from 'next/dynamic';

/**
 * Custom wallet selector with inline picker and animated swap.
 * Dynamically imported to avoid SSR issues with wallet adapter hooks.
 */
const WalletButtonInner = dynamic(
  () => import('./WalletButtonInner').then((m) => m.WalletButtonInner),
  { ssr: false },
);

export function WalletButton(): React.JSX.Element {
  return <WalletButtonInner />;
}
