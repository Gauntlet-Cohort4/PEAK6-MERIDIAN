import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TradeSide } from '@meridian/shared/types';
import type { TradeOrder } from '@meridian/shared/types';

// Must mock before importing the hook
vi.mock('../../src/lib/demo', () => ({
  IS_DEMO_MODE: true,
}));

// Mock the tx builders so they don't try real Solana operations
vi.mock('../../src/lib/tx/mint-pair', () => ({
  buildMintPairInstruction: vi.fn(),
  buildMintPairTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/redeem', () => ({
  buildRedeemInstruction: vi.fn(),
  buildRedeemTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/buy-no', () => ({
  buildBuyNoInstruction: vi.fn(),
  buildBuyNoTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/sell-no', () => ({
  buildSellNoInstruction: vi.fn(),
  buildSellNoTransaction: vi.fn(),
}));

vi.mock('../../src/lib/tx/program', () => ({
  deriveYesMintPda: vi.fn().mockReturnValue([{}]),
  deriveAta: vi.fn().mockReturnValue({}),
  USDC_MINT: {},
}));

const mockPublicKey = {
  toBase58: () => '11111111111111111111111111111111',
};

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: mockPublicKey,
    signTransaction: vi.fn(),
    connected: true,
  }),
}));

// Import after mocks are set up
import { useTradeActions } from '../../src/hooks/useTradeActions';

describe('useTradeActions (demo mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial state with no submission in progress', () => {
    const { result } = renderHook(() => useTradeActions());

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.lastError).toBeNull();
    expect(result.current.lastTxSignature).toBeNull();
    expect(typeof result.current.submitOrder).toBe('function');
  });

  it('submits a BUY_YES order and returns a demo signature', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.BUY_YES,
      size: 10,
      price: 0.65,
      traderPublicKey: '11111111111111111111111111111111',
    };

    let signature: string | undefined;
    await act(async () => {
      signature = await result.current.submitOrder(order);
    });

    expect(signature).toBeDefined();
    expect(signature!.startsWith('demo_')).toBe(true);
    expect(result.current.lastTxSignature).toBe(signature);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('submits a BUY_NO order and returns a demo signature', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '5nfGF5x3HK7d8sQKrEfZn4TqPLgQ8Y3JKiUqzsXkFVrR',
      side: TradeSide.BUY_NO,
      size: 5,
      price: 0.40,
      traderPublicKey: '11111111111111111111111111111111',
    };

    let signature: string | undefined;
    await act(async () => {
      signature = await result.current.submitOrder(order);
    });

    expect(signature).toBeDefined();
    expect(signature!.startsWith('demo_')).toBe(true);
  });

  it('submits a SELL_YES order in demo mode', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.SELL_YES,
      size: 5,
      price: 0.70,
      traderPublicKey: '11111111111111111111111111111111',
    };

    let signature: string | undefined;
    await act(async () => {
      signature = await result.current.submitOrder(order);
    });

    expect(signature!.startsWith('demo_')).toBe(true);
  });

  it('submits a REDEEM_YES order in demo mode', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '4xWW5y9HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
      side: TradeSide.REDEEM_YES,
      size: 10,
      price: 1.0,
      traderPublicKey: '11111111111111111111111111111111',
    };

    let signature: string | undefined;
    await act(async () => {
      signature = await result.current.submitOrder(order);
    });

    expect(signature!.startsWith('demo_')).toBe(true);
  });

  it('submits a REDEEM_NO order in demo mode', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '4xWW5y9HBKR7d8sQNrEfZn4TqPLgQ8Y3JKiUqzsXkFVr',
      side: TradeSide.REDEEM_NO,
      size: 8,
      price: 1.0,
      traderPublicKey: '11111111111111111111111111111111',
    };

    let signature: string | undefined;
    await act(async () => {
      signature = await result.current.submitOrder(order);
    });

    expect(signature!.startsWith('demo_')).toBe(true);
  });

  it('produces unique signatures for consecutive orders', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.BUY_YES,
      size: 1,
      price: 0.50,
      traderPublicKey: '',
    };

    let sig1: string | undefined;
    let sig2: string | undefined;

    await act(async () => {
      sig1 = await result.current.submitOrder(order);
    });
    await act(async () => {
      sig2 = await result.current.submitOrder(order);
    });

    expect(sig1).not.toBe(sig2);
  });

  it('clears error on successful submission', async () => {
    const { result } = renderHook(() => useTradeActions());

    const order: TradeOrder = {
      marketAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      side: TradeSide.BUY_YES,
      size: 1,
      price: 0.50,
      traderPublicKey: '',
    };

    await act(async () => {
      await result.current.submitOrder(order);
    });

    expect(result.current.lastError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });
});
