'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { truncateAddress } from '@/lib/format';
import { Wallet } from 'lucide-react';

/**
 * Wallet connect/disconnect button.
 * Stage A: mock implementation. Stage B will wire to @solana/react-hooks.
 */
export function WalletButton() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const handleConnect = useCallback(() => {
    // Mock: simulate wallet connection
    setConnected(true);
    setAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
  }, []);

  if (connected && address) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDisconnect}
        data-testid="wallet-button"
      >
        <Wallet className="mr-2 h-4 w-4" />
        {truncateAddress(address)}
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleConnect}
      data-testid="wallet-button"
    >
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </Button>
  );
}
