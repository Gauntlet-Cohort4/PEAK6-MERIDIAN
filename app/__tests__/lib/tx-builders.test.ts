/**
 * Tests for transaction builder functions.
 *
 * These tests mock @coral-xyz/anchor and @solana/web3.js so that builders
 * can be tested without a real Solana connection or crypto operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeridianError } from '@meridian/shared/errors';

// ── Hoisted mocks (vi.mock factories are hoisted before imports) ────────

vi.mock('@solana/web3.js', () => {
  const mockFindProgramAddressSync = vi.fn().mockReturnValue([
    {
      toBase58: () => 'MockPDA11111111111111111111111111111111111',
      toBuffer: () => Buffer.alloc(32),
      equals: () => false,
    },
    255,
  ]);

  const PubKeyClass = vi.fn().mockImplementation((key: string) => ({
    toBase58: () => key,
    toBuffer: () => Buffer.alloc(32),
    toString: () => key,
    equals: (other: { toBase58: () => string }) => key === other.toBase58(),
  }));

  PubKeyClass.findProgramAddressSync = mockFindProgramAddressSync;
  PubKeyClass.default = {
    toBase58: () => '11111111111111111111111111111111',
    toBuffer: () => Buffer.alloc(32),
  };

  return {
    PublicKey: PubKeyClass,
    Connection: vi.fn().mockImplementation(() => ({})),
  };
});

vi.mock('@coral-xyz/anchor', () => {
  const mockInstruction = vi.fn().mockResolvedValue({
    programId: { toBase58: () => 'DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE' },
    keys: [],
    data: Buffer.alloc(16),
  });

  const mockAccountsPartial = vi.fn().mockReturnValue({ instruction: mockInstruction });
  const mockMethodBuilder = vi.fn().mockReturnValue({ accountsPartial: mockAccountsPartial });

  return {
    Program: vi.fn().mockImplementation(() => ({
      programId: { toBase58: () => 'DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE' },
      methods: new Proxy({}, {
        get: () => mockMethodBuilder,
      }),
    })),
    AnchorProvider: vi.fn().mockImplementation(() => ({})),
    BN: vi.fn().mockImplementation((val: number | string) => ({
      toArray: (_endian: string, len: number) => new Array(len).fill(0),
      toString: () => String(val),
    })),
  };
});

// ── Import builders AFTER mocks are set up ──────────────────────────────

import { buildMintPairTransaction } from '../../src/lib/tx/mint-pair';
import { buildBuyNoTransaction } from '../../src/lib/tx/buy-no';
import { buildSellNoTransaction } from '../../src/lib/tx/sell-no';
import { buildRedeemTransaction } from '../../src/lib/tx/redeem';
import type { WalletConnection } from '../../src/lib/tx/types';

const mockWallet: WalletConnection = {
  publicKey: 'TestWalletPubkey1111111111111111111111111',
  signTransaction: async () => ({ serialized: new Uint8Array([]) }),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildMintPairTransaction', () => {
  it('should build a valid transaction with correct params', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 5 },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.feePayer).toBe(mockWallet.publicKey);
    expect(result.estimatedFee).toBe(5000);
  });

  it('should include correct program ID from IDL', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 1 },
      mockWallet,
    );

    expect(result.transaction.instructions[0]?.programId).toBe(
      'DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE',
    );
  });

  it('should derive 11 account keys (user + config + market + 2 mints + 3 ATAs + usdcMint + vault + tokenProgram)', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 1 },
      mockWallet,
    );

    expect(result.transaction.instructions[0]?.keys.length).toBe(11);
  });

  it('should mark user as signer and writable', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 1 },
      mockWallet,
    );

    const userKey = result.transaction.instructions[0]?.keys[0];
    expect(userKey?.isSigner).toBe(true);
    expect(userKey?.isWritable).toBe(true);
  });

  it('should return frozen result', () => {
    const result = buildMintPairTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 1 },
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
      buildMintPairTransaction({ marketAddress: 'market11111111111111111111111111111111111', amount: 0 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on negative amount', () => {
    expect(() =>
      buildMintPairTransaction({ marketAddress: 'market11111111111111111111111111111111111', amount: -5 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on fractional amount', () => {
    expect(() =>
      buildMintPairTransaction({ marketAddress: 'market11111111111111111111111111111111111', amount: 1.5 }, mockWallet),
    ).toThrow(MeridianError);
  });
});

describe('buildBuyNoTransaction', () => {
  it('should build a valid transaction', () => {
    const result = buildBuyNoTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', maxUsdc: 100_000_000 },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.feePayer).toBe(mockWallet.publicKey);
  });

  it('should include Phoenix program in accounts', () => {
    const result = buildBuyNoTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', maxUsdc: 100 },
      mockWallet,
    );

    const phoenixKey = result.transaction.instructions[0]?.keys.find(
      k => k.pubkey === 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    );
    expect(phoenixKey).toBeDefined();
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildBuyNoTransaction({ marketAddress: '', maxUsdc: 100 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should throw on zero maxUsdc', () => {
    expect(() =>
      buildBuyNoTransaction({ marketAddress: 'market11111111111111111111111111111111111', maxUsdc: 0 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should return frozen result', () => {
    const result = buildBuyNoTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', maxUsdc: 100 },
      mockWallet,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('buildSellNoTransaction', () => {
  it('should build a valid transaction', () => {
    const result = buildSellNoTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 10 },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.feePayer).toBe(mockWallet.publicKey);
  });

  it('should include Phoenix program in accounts', () => {
    const result = buildSellNoTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 10 },
      mockWallet,
    );

    const phoenixKey = result.transaction.instructions[0]?.keys.find(
      k => k.pubkey === 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
    );
    expect(phoenixKey).toBeDefined();
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildSellNoTransaction({ marketAddress: '', amount: 10 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should return frozen result', () => {
    const result = buildSellNoTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', amount: 10 },
      mockWallet,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('buildRedeemTransaction', () => {
  it('should build a valid transaction for YES token', () => {
    const result = buildRedeemTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', tokenType: 'yes', amount: 5 },
      mockWallet,
    );

    expect(result.transaction.instructions).toHaveLength(1);
    // Last byte should be 1 for redeemYes=true (discriminator[8] + amount[8] + bool[1])
    const data = result.transaction.instructions[0]?.data;
    expect(data?.[data.length - 1]).toBe(0x01);
  });

  it('should build a valid transaction for NO token', () => {
    const result = buildRedeemTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', tokenType: 'no', amount: 5 },
      mockWallet,
    );

    const data = result.transaction.instructions[0]?.data;
    expect(data?.[data.length - 1]).toBe(0x00);
  });

  it('should throw on empty market address', () => {
    expect(() =>
      buildRedeemTransaction({ marketAddress: '', tokenType: 'yes', amount: 5 }, mockWallet),
    ).toThrow(MeridianError);
  });

  it('should return frozen result', () => {
    const result = buildRedeemTransaction(
      { marketAddress: 'market11111111111111111111111111111111111', tokenType: 'yes', amount: 5 },
      mockWallet,
    );
    expect(Object.isFrozen(result)).toBe(true);
  });
});
