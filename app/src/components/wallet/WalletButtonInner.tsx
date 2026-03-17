'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import type { WalletName } from '@solana/wallet-adapter-base';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

type UIState = 'idle' | 'selecting';

/** Download URLs for supported wallets when extension is not installed. */
const WALLET_URLS: Record<string, string> = {
  Phantom: 'https://phantom.app/',
  Solflare: 'https://solflare.com/',
};

/**
 * Custom wallet selector button with inline picker and animated swap.
 *
 * - Disconnected: shows "Connect"; click reveals both wallet options inline.
 *   If extension is installed, clicking connects directly.
 *   If not installed, opens wallet download page in new tab.
 * - Connected: shows [small inactive logo] [active logo + "Connected" label].
 *   Clicking the small logo disconnects current and connects the other wallet.
 */
export function WalletButtonInner(): React.JSX.Element {
  const { wallets, wallet, select, disconnect, connect, connected, publicKey } = useWallet();
  const [uiState, setUiState] = useState<UIState>('idle');
  const [pendingConnect, setPendingConnect] = useState(false);
  const pathname = usePathname();

  // After select() sets the wallet, trigger connect()
  useEffect(() => {
    if (pendingConnect && wallet && !connected) {
      setPendingConnect(false);

      // Only attempt connect if the wallet is actually installed/loadable
      const isReady =
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable;

      if (isReady) {
        connect().catch(() => {
          // User rejected or extension not responding — stay disconnected
        });
      }
    }
  }, [pendingConnect, wallet, connected, connect]);

  // Close picker if we become connected
  useEffect(() => {
    if (connected) {
      setUiState('idle');
    }
  }, [connected]);

  // Close picker on route change
  useEffect(() => {
    setUiState('idle');
  }, [pathname]);

  const handleSelectWallet = useCallback(
    (w: (typeof wallets)[number]) => {
      if (w.readyState === WalletReadyState.Installed) {
        // Extension is definitely present — connect directly
        select(w.adapter.name as WalletName);
        setPendingConnect(true);
      } else if (w.readyState === WalletReadyState.Loadable) {
        // Adapter registered but extension may not be present — try connect,
        // the catch in the useEffect will handle failure silently
        select(w.adapter.name as WalletName);
        setPendingConnect(true);
      } else {
        // Not installed — open download page
        const url = WALLET_URLS[w.adapter.name] ?? w.adapter.url;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [select],
  );

  const handleSwap = useCallback(
    async (targetWallet: (typeof wallets)[number]) => {
      const isInstalled =
        targetWallet.readyState === WalletReadyState.Installed ||
        targetWallet.readyState === WalletReadyState.Loadable;

      if (!isInstalled) {
        const url = WALLET_URLS[targetWallet.adapter.name] ?? targetWallet.adapter.url;
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      try {
        await disconnect();
      } catch {
        // Disconnect can throw if not connected — safe to ignore
      }
      // Small delay to let disconnect settle before selecting new wallet
      setTimeout(() => {
        select(targetWallet.adapter.name as WalletName);
        setPendingConnect(true);
      }, 100);
    },
    [disconnect, select],
  );

  // Truncate public key for display: "Ab3d...xY9z"
  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null;

  // ── Disconnected: "Connect" or inline picker ──
  if (!connected || !wallet) {
    if (uiState === 'selecting') {
      return (
        <div
          className="flex items-center gap-1 rounded-md border border-[#1e2a3a] bg-[#111827] p-1"
          data-testid="wallet-button"
        >
          {wallets.map((w) => {
            const isInstalled =
              w.readyState === WalletReadyState.Installed ||
              w.readyState === WalletReadyState.Loadable;

            return (
              <button
                key={w.adapter.name}
                onClick={() => handleSelectWallet(w)}
                className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[#1a2035] text-[#e2e8f0]"
                title={`Connect ${w.adapter.name}`}
              >
                <Image
                  src={w.adapter.icon}
                  alt={w.adapter.name}
                  width={20}
                  height={20}
                  className="rounded-sm"
                  unoptimized
                />
                <span className="hidden sm:inline">{w.adapter.name}</span>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <button
        onClick={() => setUiState('selecting')}
        className="flex items-center gap-2 rounded-md bg-[#3b82f6] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2563eb]"
        data-testid="wallet-button"
      >
        Connect
      </button>
    );
  }

  // ── Connected: [small inactive] [active + address] ──
  const activeWallet = wallet;
  const inactiveWallet = wallets.find(
    (w) => w.adapter.name !== activeWallet.adapter.name,
  );

  return (
    <div
      className="flex items-center gap-1 rounded-md border border-[#1e2a3a] bg-[#111827] p-1"
      data-testid="wallet-button"
    >
      {/* Small inactive wallet logo — click to swap */}
      {inactiveWallet && (
        <button
          onClick={() => handleSwap(inactiveWallet)}
          className="flex items-center justify-center rounded-sm p-1 transition-all duration-200 ease-in-out hover:bg-[#1a2035]"
          title={`Switch to ${inactiveWallet.adapter.name}`}
        >
          <Image
            src={inactiveWallet.adapter.icon}
            alt={inactiveWallet.adapter.name}
            width={18}
            height={18}
            className="rounded-sm opacity-50 transition-opacity duration-200 hover:opacity-100"
            unoptimized
          />
        </button>
      )}

      {/* Active wallet — large logo + address */}
      <div className="flex items-center gap-1.5 rounded-sm bg-[#3b82f6]/10 px-2.5 py-1 transition-all duration-200 ease-in-out">
        <Image
          src={activeWallet.adapter.icon}
          alt={activeWallet.adapter.name}
          width={20}
          height={20}
          className="rounded-sm"
          unoptimized
        />
        <span className="text-xs font-medium font-mono text-[#e2e8f0]">
          {truncatedAddress ?? activeWallet.adapter.name}
        </span>
        <span className="text-[10px] text-[#3b82f6] font-semibold">Connected</span>
      </div>
    </div>
  );
}
