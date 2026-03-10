/**
 * Tests for the Meridian client that wraps on-chain interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMeridianClient,
  type MeridianClientDeps,
  type CreateStrikeMarketParams,
  type SettleMarketParams,
  type AdminSettleParams,
} from '../src/services/meridian-client.js';
import type { TransactionSender } from '../src/services/transaction-sender.js';
import { MeridianError } from '@meridian/shared/errors.js';

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

describe('createMeridianClient', () => {
  describe('createStrikeMarket', () => {
    it('should call transactionSender and return signature', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: CreateStrikeMarketParams = {
        ticker: 'AAPL',
        strikePrice: 190,
        tradingDate: 1700000000,
        phoenixMarketAddress: 'phoenix-market-addr',
      };

      const sig = await client.createStrikeMarket(params);

      expect(sig).toBe('mock-sig-abc123');
      expect(deps.transactionSender.sendAndConfirm).toHaveBeenCalledOnce();
    });

    it('should pass instruction with correct type', async () => {
      const sendAndConfirm = vi.fn().mockResolvedValue('sig-1');
      const deps = createMockDeps({
        transactionSender: { sendAndConfirm },
      });
      const client = createMeridianClient(deps);

      await client.createStrikeMarket({
        ticker: 'MSFT',
        strikePrice: 420,
        tradingDate: 1700000000,
        phoenixMarketAddress: 'phoenix-msft',
      });

      const instruction = sendAndConfirm.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(instruction['type']).toBe('create_strike_market');
      expect(instruction['ticker']).toBe('MSFT');
      expect(instruction['strikePrice']).toBe(420);
    });

    it('should throw MeridianError on transaction failure', async () => {
      const deps = createMockDeps({
        transactionSender: {
          sendAndConfirm: vi.fn().mockRejectedValue(new Error('RPC timeout')),
        },
      });
      const client = createMeridianClient(deps);

      await expect(
        client.createStrikeMarket({
          ticker: 'AAPL',
          strikePrice: 190,
          tradingDate: 1700000000,
          phoenixMarketAddress: 'phoenix-aapl',
        }),
      ).rejects.toThrow(MeridianError);
    });
  });

  describe('settleMarket', () => {
    it('should call transactionSender and return signature', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: SettleMarketParams = {
        marketAddress: 'market-addr-1',
        pythPriceAccount: 'pyth-feed-id',
      };

      const sig = await client.settleMarket(params);

      expect(sig).toBe('mock-sig-abc123');
      expect(deps.transactionSender.sendAndConfirm).toHaveBeenCalledOnce();
    });

    it('should pass instruction with settle_market type', async () => {
      const sendAndConfirm = vi.fn().mockResolvedValue('sig-2');
      const deps = createMockDeps({
        transactionSender: { sendAndConfirm },
      });
      const client = createMeridianClient(deps);

      await client.settleMarket({
        marketAddress: 'market-settle',
        pythPriceAccount: 'pyth-account',
      });

      const instruction = sendAndConfirm.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(instruction['type']).toBe('settle_market');
      expect(instruction['marketAddress']).toBe('market-settle');
    });

    it('should throw MeridianError on failure', async () => {
      const deps = createMockDeps({
        transactionSender: {
          sendAndConfirm: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      });
      const client = createMeridianClient(deps);

      await expect(
        client.settleMarket({
          marketAddress: 'market-x',
          pythPriceAccount: 'pyth-x',
        }),
      ).rejects.toThrow(MeridianError);
    });
  });

  describe('adminSettle', () => {
    it('should call transactionSender and return signature', async () => {
      const deps = createMockDeps();
      const client = createMeridianClient(deps);

      const params: AdminSettleParams = {
        marketAddress: 'market-admin-1',
        outcomeYesWins: true,
      };

      const sig = await client.adminSettle(params);

      expect(sig).toBe('mock-sig-abc123');
      expect(deps.transactionSender.sendAndConfirm).toHaveBeenCalledOnce();
    });

    it('should pass instruction with admin_settle type', async () => {
      const sendAndConfirm = vi.fn().mockResolvedValue('sig-3');
      const deps = createMockDeps({
        transactionSender: { sendAndConfirm },
      });
      const client = createMeridianClient(deps);

      await client.adminSettle({
        marketAddress: 'market-admin',
        outcomeYesWins: false,
      });

      const instruction = sendAndConfirm.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(instruction['type']).toBe('admin_settle');
      expect(instruction['outcomeYesWins']).toBe(false);
    });

    it('should throw MeridianError on failure', async () => {
      const deps = createMockDeps({
        transactionSender: {
          sendAndConfirm: vi.fn().mockRejectedValue(new Error('Admin rejected')),
        },
      });
      const client = createMeridianClient(deps);

      await expect(
        client.adminSettle({
          marketAddress: 'market-z',
          outcomeYesWins: true,
        }),
      ).rejects.toThrow(MeridianError);
    });
  });

  it('should return a frozen client object', () => {
    const deps = createMockDeps();
    const client = createMeridianClient(deps);

    expect(Object.isFrozen(client)).toBe(true);
  });
});
