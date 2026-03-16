import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TradeSide } from '@meridian/shared/types';
import type { TradeOrder } from '@meridian/shared/types';

// Mock demo mode OFF — tests the real wallet path
vi.mock('../../src/lib/demo', () => ({
  IS_DEMO_MODE: false,
}));

// Mock tx builders — factory functions avoid hoisting issues with vi.mock
vi.mock('../../src/lib/tx/mint-pair', () => ({
  buildMintPairInstruction: vi.fn().mockResolvedValue({ keys: [], programId: {}, data: Buffer.alloc(0) }),
  buildMintPairTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/redeem', () => ({
  buildRedeemInstruction: vi.fn().mockResolvedValue({ keys: [], programId: {}, data: Buffer.alloc(0) }),
  buildRedeemTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/buy-no', () => ({
  buildBuyNoInstruction: vi.fn().mockResolvedValue({ keys: [], programId: {}, data: Buffer.alloc(0) }),
  buildBuyNoTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/sell-no', () => ({
  buildSellNoInstruction: vi.fn().mockResolvedValue({ keys: [], programId: {}, data: Buffer.alloc(0) }),
  buildSellNoTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/program', () => ({
  deriveYesMintPda: vi.fn().mockReturnValue([{}]),
  deriveAta: vi.fn().mockReturnValue({}),
  USDC_MINT: {},
}));

// --- Wallet mock state (controlled per-test) ---
let mockWalletState = {
  publicKey: null as { toBase58: () => string } | null,
  signTransaction: null as ReturnType<typeof vi.fn> | null,
  connected: false,
};

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockWalletState,
}));

// Import after mocks
import { useTradeActions } from '../../src/hooks/useTradeActions';

describe('useTradeActions (real mode — wallet required)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: disconnected wallet
    mockWalletState = {
      publicKey: null,
      signTransaction: null,
      connected: false,
    };
  });

  it('throws when wallet is not connected', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.BUY_YES,
      size: 10,
      price: 0.65,
      traderPublicKey: '',
    };

    await act(async () => {
      try {
        await result.current.submitOrder(order);
        expect.fail('Should have thrown for disconnected wallet');
      } catch (err: unknown) {
        expect(err).toBeDefined();
        expect((err as Error).message).toContain('Wallet is not connected');
      }
    });

    expect(result.current.lastError).toContain('Wallet is not connected');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('throws when wallet has no signTransaction capability', async () => {
    mockWalletState = {
      publicKey: { toBase58: () => '11111111111111111111111111111111' },
      signTransaction: null,
      connected: true,
    };

    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.BUY_YES,
      size: 10,
      price: 0.65,
      traderPublicKey: '',
    };

    await act(async () => {
      try {
        await result.current.submitOrder(order);
        expect.fail('Should have thrown for missing signTransaction');
      } catch (err: unknown) {
        expect(err).toBeDefined();
        expect((err as Error).message).toContain('does not support transaction signing');
      }
    });

    expect(result.current.lastError).toContain('does not support transaction signing');
  });

  it('sets lastError on submission failure and clears isSubmitting', async () => {
    mockWalletState = {
      publicKey: null,
      signTransaction: null,
      connected: false,
    };

    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.BUY_YES,
      size: 10,
      price: 0.65,
      traderPublicKey: '',
    };

    await act(async () => {
      try {
        await result.current.submitOrder(order);
      } catch {
        // Expected
      }
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.lastError).not.toBeNull();
    expect(result.current.lastTxSignature).toBeNull();
  });
});
