/**
 * Tests for the Meridian client that wraps on-chain interactions.
 * Tests the stub (demo mode) client which is used by createMeridianClient.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMeridianClient,
  createStubMeridianClient,
  type MeridianClientDeps,
  type CreateStrikeMarketParams,
  type SettleMarketParams,
  type AdminSettleParams,
} from '../src/services/meridian-client.js';
import type { TransactionSender } from '../src/services/transaction-sender.js';

function createMockDeps(
  overrides?: Partial<MeridianClientDeps>,
): MeridianClientDeps {
  const transactionSender: TransactionSender = {
    sendAndConfirm: vi.fn().mockResolvedValue('mock-sig-abc123'),
  };

  return {
    transactionSender: overrides?.transactionSender ?? transactionSender,
    programId: overrides?.programId ?? 'MeridianProgram111111111111111111',
    adminKeypairPath: overrides?.adminKeypairPath ?? '/tmp/admin.json',
  };
}

describe('createMeridianClient (stub/demo mode)', () => {
  describe('createStrikeMarket', () => {
    it('should return a signature string', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: CreateStrikeMarketParams = {
        ticker: 'AAPL',
        strikePrice: 190,
        tradingDate: 1700000000,
        phoenixMarketAddress: 'phoenix-market-addr',
      };

      const sig = await client.createStrikeMarket(params);

      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(0);
      expect(sig).toContain('stub-create');
    });

    it('should return unique signatures on each call', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: CreateStrikeMarketParams = {
        ticker: 'MSFT',
        strikePrice: 420,
        tradingDate: 1700000000,
        phoenixMarketAddress: 'phoenix-msft',
      };

      const sig1 = await client.createStrikeMarket(params);
      const sig2 = await client.createStrikeMarket(params);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('settleMarket', () => {
    it('should return a signature string', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: SettleMarketParams = {
        marketAddress: 'market-addr-1',
        pythPriceAccount: 'pyth-feed-id',
      };

      const sig = await client.settleMarket(params);

      expect(typeof sig).toBe('string');
      expect(sig).toContain('stub-settle');
    });
  });

  describe('adminSettle', () => {
    it('should return a signature string', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: AdminSettleParams = {
        marketAddress: 'market-admin-1',
        outcomeYesWins: true,
        settlementPrice: 18500,
      };

      const sig = await client.adminSettle(params);

      expect(typeof sig).toBe('string');
      expect(sig).toContain('stub-admin-settle');
    });
  });

  it('should return a frozen client object', () => {
    const deps = createMockDeps();
    const client = createMeridianClient(deps);

    expect(Object.isFrozen(client)).toBe(true);
  });
});

describe('createStubMeridianClient', () => {
  it('should be the same as createMeridianClient for backward compat', async () => {
    const deps = createMockDeps();
    const client = createStubMeridianClient(deps);

    const params: CreateStrikeMarketParams = {
      ticker: 'AAPL',
      strikePrice: 190,
      tradingDate: 1700000000,
      phoenixMarketAddress: 'phoenix-aapl',
    };

    const sig = await client.createStrikeMarket(params);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('should not throw errors', async () => {
    const deps = createMockDeps();
    const client = createStubMeridianClient(deps);

    await expect(
      client.createStrikeMarket({
        ticker: 'AAPL',
        strikePrice: 190,
        tradingDate: 1700000000,
        phoenixMarketAddress: 'phoenix-aapl',
      }),
    ).resolves.toBeDefined();

    await expect(
      client.settleMarket({
        marketAddress: 'market-1',
        pythPriceAccount: 'pyth-1',
      }),
    ).resolves.toBeDefined();

    await expect(
      client.adminSettle({
        marketAddress: 'market-2',
        outcomeYesWins: false,
        settlementPrice: 88000,
      }),
    ).resolves.toBeDefined();
  });
});
