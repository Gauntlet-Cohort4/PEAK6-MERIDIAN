/**
 * Tests for transaction builder functions.
 */

import { describe, it, expect } from 'vitest';
import { buildMintPairTransaction } from '../../src/lib/tx/mint-pair';
import { buildBuyNoTransaction } from '../../src/lib/tx/buy-no';
import { buildSellNoTransaction } from '../../src/lib/tx/sell-no';
import { buildRedeemTransaction } from '../../src/lib/tx/redeem';
import type { WalletConnection } from '../../src/lib/tx/types';
import { MeridianError } from '@meridian/shared/errors';

const mockWallet: WalletConnection = {
  publicKey: 'TestWalletPubkey1111111111111111111111111',
  signTransaction: async () => ({ serialized: new Uint8Array([]) }),
};

describe('buildMintPairTransaction', () => {
  it('should build a valid transaction with correct params', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market-123', amount: 5 },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.feePayer).toBe(mockWallet.publicKey);
    expect(result.estimatedFee).toBe(5000);
  });

  it('should include market address in instruction keys', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market-abc', amount: 1 },
      mockWallet,
    );

    const keys = result.transaction.instructions[0]?.keys;
    expect(keys?.[0]?.pubkey).toBe('market-abc');
  });

  it('should return frozen result', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market-freeze', amount: 1 },
      mockWallet,
    );

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildMintPairTransaction({ marketAddress: '', amount: 1 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on zero amount', () => {
    expect(() =>
      buildMintPairTransaction({ marketAddress: 'market-1', amount: 0 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on negative amount', () => {
    expect(() =>
      buildMintPairTransaction({ marketAddress: 'market-1', amount: -5 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on fractional amount', () => {
    expect(() =>
      buildMintPairTransaction({ marketAddress: 'market-1', amount: 1.5 }, mockWallet),
    ).toThrow(MeridianError);
  });
});

describe('buildBuyNoTransaction', () => {
  it('should build a valid transaction', () => {
    const result = buildBuyNoTransaction(
      { marketAddress: 'market-buy', maxUsdc: 100_000_000 },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.feePayer).toBe(mockWallet.publicKey);
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildBuyNoTransaction({ marketAddress: '', maxUsdc: 100 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on zero maxUsdc', () => {
    expect(() =>
      buildBuyNoTransaction({ marketAddress: 'market-1', maxUsdc: 0 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should return frozen result', () => {
    const result = buildBuyNoTransaction(
      { marketAddress: 'market-1', maxUsdc: 100 },
      mockWallet,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('buildSellNoTransaction', () => {
  it('should build a valid transaction', () => {
    const result = buildSellNoTransaction(
      { marketAddress: 'market-sell' },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.feePayer).toBe(mockWallet.publicKey);
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildSellNoTransaction({ marketAddress: '' }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should return frozen result', () => {
    const result = buildSellNoTransaction(
      { marketAddress: 'market-1' },
      mockWallet,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('buildRedeemTransaction', () => {
  it('should build a valid transaction for YES token', () => {
    const result = buildRedeemTransaction(
      { marketAddress: 'market-redeem', tokenType: 'yes' },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.instructions[0]?.data[1]).toBe(0x01); // yes flag
  });

  it('should build a valid transaction for NO token', () => {
    const result = buildRedeemTransaction(
      { marketAddress: 'market-redeem', tokenType: 'no' },
      mockWallet,
    );

    expect(result.transaction.instructions[0]?.data[1]).toBe(0x00); // no flag
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildRedeemTransaction({ marketAddress: '', tokenType: 'yes' }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should return frozen result', () => {
    const result = buildRedeemTransaction(
      { marketAddress: 'market-1', tokenType: 'yes' },
      mockWallet,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});
