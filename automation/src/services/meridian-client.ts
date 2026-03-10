/**
 * @module meridian-client
 * Typed client for the Meridian Anchor program.
 * Wraps on-chain instruction building and transaction submission.
 *
 * TODO: Replace stub implementations with actual Anchor IDL-based
 * instruction building once the program is built and the IDL artifact
 * is available.
 */

import { MERIDIAN_CONFIG } from '@meridian/shared/constants.js';
import { Logger } from '@meridian/shared/logger.js';
import { debugLog } from '@meridian/shared/debug.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors.js';
import type { TransactionSender } from './transaction-sender.js';

const logger = new Logger('meridian-client');

/** Parameters for creating a new strike market on-chain. */
export interface CreateStrikeMarketParams {
  readonly ticker: string;
  readonly strikePrice: number;
  readonly tradingDate: number;
  readonly phoenixMarketAddress: string;
}

/** Parameters for settling a market via oracle price. */
export interface SettleMarketParams {
  readonly marketAddress: string;
  readonly pythPriceAccount: string;
}

/** Parameters for admin force-settlement. */
export interface AdminSettleParams {
  readonly marketAddress: string;
  readonly outcomeYesWins: boolean;
}

/** Typed client interface for the Meridian Anchor program. */
export interface MeridianClient {
  /** Create a new strike market and return the tx signature. */
  createStrikeMarket(params: CreateStrikeMarketParams): Promise<string>;

  /** Settle a market using Pyth oracle price, return tx signature. */
  settleMarket(params: SettleMarketParams): Promise<string>;

  /** Admin force-settle a market, return tx signature. */
  adminSettle(params: AdminSettleParams): Promise<string>;
}

/** Dependencies for the Meridian client. */
export interface MeridianClientDeps {
  readonly transactionSender: TransactionSender;
  readonly programId: string;
  readonly adminKeypairPath: string;
}

/**
 * Build the create_strike_market instruction.
 *
 * TODO: Import the Meridian IDL and use Anchor's Program class to build
 * the actual instruction. For now returns a placeholder object.
 */
function buildCreateStrikeMarketInstruction(
  params: CreateStrikeMarketParams,
  programId: string,
): Readonly<Record<string, unknown>> {
  debugLog('TX_BUILDING', 'meridian-client', 'buildCreateStrikeMarketIx', 'Building instruction', {
    ticker: params.ticker,
    strikePrice: params.strikePrice,
    tradingDate: params.tradingDate,
    phoenixMarketAddress: params.phoenixMarketAddress,
    programId,
  });

  // TODO: Replace with actual Anchor instruction building:
  // const program = new Program(MeridianIDL, programId, provider);
  // return program.methods
  //   .createStrikeMarket(params.ticker, new BN(params.strikePrice), ...)
  //   .accounts({ ... })
  //   .instruction();
  return Object.freeze({
    type: 'create_strike_market',
    ...params,
    programId,
  });
}

/**
 * Build the settle_market instruction.
 *
 * TODO: Import the Meridian IDL and build the actual instruction.
 */
function buildSettleMarketInstruction(
  params: SettleMarketParams,
  programId: string,
): Readonly<Record<string, unknown>> {
  debugLog('TX_BUILDING', 'meridian-client', 'buildSettleMarketIx', 'Building instruction', {
    marketAddress: params.marketAddress,
    pythPriceAccount: params.pythPriceAccount,
    programId,
  });

  // TODO: Replace with actual Anchor instruction building
  return Object.freeze({
    type: 'settle_market',
    ...params,
    programId,
  });
}

/**
 * Build the admin_settle instruction.
 *
 * TODO: Import the Meridian IDL and build the actual instruction.
 */
function buildAdminSettleInstruction(
  params: AdminSettleParams,
  programId: string,
): Readonly<Record<string, unknown>> {
  debugLog('TX_BUILDING', 'meridian-client', 'buildAdminSettleIx', 'Building instruction', {
    marketAddress: params.marketAddress,
    outcomeYesWins: params.outcomeYesWins,
    programId,
  });

  // TODO: Replace with actual Anchor instruction building
  return Object.freeze({
    type: 'admin_settle',
    ...params,
    programId,
  });
}

/**
 * Create a MeridianClient instance backed by the given dependencies.
 * All methods build instructions, wrap them in transactions, and submit
 * via the TransactionSender.
 */
export function createMeridianClient(deps: MeridianClientDeps): MeridianClient {
  const { transactionSender, programId, adminKeypairPath } = deps;

  async function createStrikeMarket(params: CreateStrikeMarketParams): Promise<string> {
    logger.info('createStrikeMarket', `Creating strike market: ${params.ticker} @ $${params.strikePrice}`, {
      context: {
        ticker: params.ticker,
        strikePrice: params.strikePrice,
        tradingDate: params.tradingDate,
        phoenixMarketAddress: params.phoenixMarketAddress,
      },
    });

    try {
      const instruction = buildCreateStrikeMarketInstruction(params, programId);

      // TODO: Build a real Transaction from the instruction and sign with admin keypair
      // const tx = new Transaction().add(instruction);
      // const adminKeypair = loadKeypair(adminKeypairPath);
      const signature = await transactionSender.sendAndConfirm(instruction, [adminKeypairPath]);

      logger.info('createStrikeMarket', `Strike market created: ${params.ticker} @ $${params.strikePrice}`, {
        context: { signature, ticker: params.ticker, strikePrice: params.strikePrice },
      });

      return signature;
    } catch (err) {
      throw new MeridianError(
        MeridianErrorCode.RPC_ERROR,
        `Failed to create strike market for ${params.ticker} @ $${params.strikePrice}`,
        err,
        { ticker: params.ticker, strikePrice: params.strikePrice },
      );
    }
  }

  async function settleMarket(params: SettleMarketParams): Promise<string> {
    logger.info('settleMarket', `Settling market: ${params.marketAddress}`, {
      context: {
        marketAddress: params.marketAddress,
        pythPriceAccount: params.pythPriceAccount,
      },
    });

    try {
      const instruction = buildSettleMarketInstruction(params, programId);

      // TODO: Build and sign real transaction
      const signature = await transactionSender.sendAndConfirm(instruction, [adminKeypairPath]);

      logger.info('settleMarket', `Market settled: ${params.marketAddress}`, {
        context: { signature, marketAddress: params.marketAddress },
      });

      return signature;
    } catch (err) {
      throw new MeridianError(
        MeridianErrorCode.RPC_ERROR,
        `Failed to settle market ${params.marketAddress}`,
        err,
        { marketAddress: params.marketAddress },
      );
    }
  }

  async function adminSettle(params: AdminSettleParams): Promise<string> {
    logger.info('adminSettle', `Admin settling market: ${params.marketAddress}`, {
      context: {
        marketAddress: params.marketAddress,
        outcomeYesWins: params.outcomeYesWins,
      },
    });

    try {
      const instruction = buildAdminSettleInstruction(params, programId);

      // TODO: Build and sign real transaction
      const signature = await transactionSender.sendAndConfirm(instruction, [adminKeypairPath]);

      logger.info('adminSettle', `Market admin-settled: ${params.marketAddress}`, {
        context: {
          signature,
          marketAddress: params.marketAddress,
          outcomeYesWins: params.outcomeYesWins,
        },
      });

      return signature;
    } catch (err) {
      throw new MeridianError(
        MeridianErrorCode.RPC_ERROR,
        `Failed to admin-settle market ${params.marketAddress}`,
        err,
        { marketAddress: params.marketAddress, outcomeYesWins: params.outcomeYesWins },
      );
    }
  }

  return Object.freeze({ createStrikeMarket, settleMarket, adminSettle });
}
