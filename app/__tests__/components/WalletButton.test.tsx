import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletButtonInner } from '../../src/components/wallet/WalletButtonInner';
import { WalletReadyState } from '@solana/wallet-adapter-base';

// Mock next/image to a plain <img>
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { unoptimized: _u, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

// Shared mock state
const mockSelect = vi.fn();
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

const phantomAdapter = {
  name: 'Phantom',
  icon: 'https://phantom.app/icon.png',
  url: 'https://phantom.app/',
  readyState: WalletReadyState.Installed,
};

const solflareAdapter = {
  name: 'Solflare',
  icon: 'https://solflare.com/icon.png',
  url: 'https://solflare.com/',
  readyState: WalletReadyState.NotDetected,
};

const installedWallets = [
  { adapter: phantomAdapter, readyState: WalletReadyState.Installed },
  { adapter: solflareAdapter, readyState: WalletReadyState.NotDetected },
];

function mockUseWallet(overrides: Record<string, unknown> = {}) {
  return {
    wallets: installedWallets,
    wallet: null,
    select: mockSelect,
    disconnect: mockDisconnect,
    connected: false,
    publicKey: null,
    ...overrides,
  };
}

let walletState = mockUseWallet();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => walletState,
}));

describe('WalletButtonInner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletState = mockUseWallet();
  });

  describe('Disconnected state', () => {
    it('renders Connect button when not connected', () => {
      render(<WalletButtonInner />);
      const btn = screen.getByTestId('wallet-button');
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('Connect');
    });

    it('shows wallet options after clicking Connect', async () => {
      const user = userEvent.setup();
      render(<WalletButtonInner />);

      await user.click(screen.getByText('Connect'));

      // Should now show wallet adapter names
      expect(screen.getByTitle('Connect Phantom')).toBeInTheDocument();
      expect(screen.getByTitle('Install Solflare')).toBeInTheDocument();
    });

    it('calls select when clicking an installed wallet', async () => {
      const user = userEvent.setup();
      render(<WalletButtonInner />);

      await user.click(screen.getByText('Connect'));
      await user.click(screen.getByTitle('Connect Phantom'));

      expect(mockSelect).toHaveBeenCalledWith('Phantom');
    });

    it('opens download link for uninstalled wallet', async () => {
      const user = userEvent.setup();
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(<WalletButtonInner />);

      await user.click(screen.getByText('Connect'));
      await user.click(screen.getByTitle('Install Solflare'));

      expect(windowOpen).toHaveBeenCalledWith(
        'https://solflare.com/',
        '_blank',
        'noopener,noreferrer',
      );
      expect(mockSelect).not.toHaveBeenCalled();

      windowOpen.mockRestore();
    });

    it('shows Install label for uninstalled wallets', async () => {
      const user = userEvent.setup();
      render(<WalletButtonInner />);

      await user.click(screen.getByText('Connect'));

      const installLabels = screen.getAllByText('Install');
      expect(installLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('dims icon for uninstalled wallets', async () => {
      const user = userEvent.setup();
      render(<WalletButtonInner />);

      await user.click(screen.getByText('Connect'));

      const solflareImg = screen.getByAltText('Solflare');
      expect(solflareImg.className).toContain('opacity-40');
    });
  });

  describe('Connected state', () => {
    const mockPublicKey = {
      toBase58: () => 'Ab3dEfGh1234567890abcdefghijklmnopqrstuvwxY9z',
    };

    beforeEach(() => {
      walletState = mockUseWallet({
        connected: true,
        wallet: { adapter: phantomAdapter },
        publicKey: mockPublicKey,
      });
    });

    it('shows Connected label and truncated address', () => {
      render(<WalletButtonInner />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Ab3d...xY9z')).toBeInTheDocument();
    });

    it('shows active wallet icon', () => {
      render(<WalletButtonInner />);
      const activeImg = screen.getByAltText('Phantom');
      expect(activeImg).toBeInTheDocument();
    });

    it('shows swap button for the inactive wallet', () => {
      render(<WalletButtonInner />);
      const swapBtn = screen.getByTitle('Switch to Solflare');
      expect(swapBtn).toBeInTheDocument();
    });

    it('calls disconnect when swapping to another wallet', async () => {
      const user = userEvent.setup();

      // Make Solflare installed for swap scenario
      const bothInstalled = [
        { adapter: phantomAdapter, readyState: WalletReadyState.Installed },
        {
          adapter: { ...solflareAdapter, readyState: WalletReadyState.Installed },
          readyState: WalletReadyState.Installed,
        },
      ];
      walletState = mockUseWallet({
        connected: true,
        wallet: { adapter: phantomAdapter },
        publicKey: mockPublicKey,
        wallets: bothInstalled,
      });

      render(<WalletButtonInner />);

      await user.click(screen.getByTitle('Switch to Solflare'));

      // disconnect is called as part of the swap flow
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('opens download page when swapping to uninstalled wallet', async () => {
      const user = userEvent.setup();
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(<WalletButtonInner />);

      await user.click(screen.getByTitle('Switch to Solflare'));

      // Solflare is NotDetected, so it opens the download page
      expect(windowOpen).toHaveBeenCalledWith(
        'https://solflare.com/',
        '_blank',
        'noopener,noreferrer',
      );
      expect(mockDisconnect).not.toHaveBeenCalled();

      windowOpen.mockRestore();
    });
  });
});
