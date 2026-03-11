/**
 * @module meridian-client
 * Typed client for the Meridian Anchor program.
 * Wraps on-chain instruction building and transaction submission.
 *
 * When DEMO_MODE is true, returns stub signatures without touching chain.
 * When DEMO_MODE is false, builds real Anchor instructions from the IDL.
 */

import { Program, AnchorProvider, BN, type Idl } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { MERIDIAN_CONFIG } from '@meridian/shared/constants.js';
import { Logger } from '@meridian/shared/logger.js';
import { debugLog } from '@meridian/shared/debug.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors.js';
import type { TransactionSender } from './transaction-sender.js';

import MeridianIDL from '../idl/meridian.json' with { type: 'json' };

const logger = new Logger('meridian-client');

/** SPL Token program ID. */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** SPL Associated Token program ID. */
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

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
  readonly settlementPrice: number;
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

/** Extended dependencies for the real (non-demo) Meridian client. */
export interface RealMeridianClientDeps extends MeridianClientDeps {
  readonly connection: Connection;
  readonly adminKeypair: Keypair;
  readonly usdcMint: PublicKey;
}

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

function deriveConfigPda(programId: PublicKey): readonly [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId,
  );
}

function deriveTickerConfigPda(
  symbol: string,
  programId: PublicKey,
): readonly [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('ticker'), Buffer.from(symbol)],
    programId,
  );
}

function deriveStrikeMarketPda(
  symbol: string,
  strikePrice: BN,
  tradingDate: BN,
  programId: PublicKey,
): readonly [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('market'),
      Buffer.from(symbol),
      strikePrice.toArrayLike(Buffer, 'le', 8),
      tradingDate.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );
}

function deriveYesMintPda(
  strikeMarket: PublicKey,
  programId: PublicKey,
): readonly [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('yes_mint'), strikeMarket.toBuffer()],
    programId,
  );
}

function deriveNoMintPda(
  strikeMarket: PublicKey,
  programId: PublicKey,
): readonly [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('no_mint'), strikeMarket.toBuffer()],
    programId,
  );
}

function deriveVaultPda(
  strikeMarket: PublicKey,
  programId: PublicKey,
): readonly [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), strikeMarket.toBuffer()],
    programId,
  );
}

// ---------------------------------------------------------------------------
// Stub (DEMO_MODE) implementation
// ---------------------------------------------------------------------------

/**
 * Create a stub MeridianClient for demo mode.
 * Returns mock signatures without building real transactions.
 */
export function createStubMeridianClient(deps: MeridianClientDeps): MeridianClient {
  const { transactionSender, programId, adminKeypairPath } = deps;

  function makeMockSignature(label: string): string {
    return `stub-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function createStrikeMarket(params: CreateStrikeMarketParams): Promise<string> {
    logger.info('createStrikeMarket', `[STUB] Creating strike market: ${params.ticker} @ $${params.strikePrice}`, {
      context: {
        ticker: params.ticker,
        strikePrice: params.strikePrice,
        tradingDate: params.tradingDate,
        phoenixMarketAddress: params.phoenixMarketAddress,
        programId,
      },
    });

    const signature = makeMockSignature('create');

    logger.info('createStrikeMarket', `[STUB] Strike market created: ${params.ticker} @ $${params.strikePrice}`, {
      context: { signature, ticker: params.ticker, strikePrice: params.strikePrice },
    });

    return signature;
  }

  async function settleMarket(params: SettleMarketParams): Promise<string> {
    logger.info('settleMarket', `[STUB] Settling market: ${params.marketAddress}`, {
      context: {
        marketAddress: params.marketAddress,
        pythPriceAccount: params.pythPriceAccount,
        programId,
      },
    });

    const signature = makeMockSignature('settle');

    logger.info('settleMarket', `[STUB] Market settled: ${params.marketAddress}`, {
      context: { signature, marketAddress: params.marketAddress },
    });

    return signature;
  }

  async function adminSettle(params: AdminSettleParams): Promise<string> {
    logger.info('adminSettle', `[STUB] Admin settling market: ${params.marketAddress}`, {
      context: {
        marketAddress: params.marketAddress,
        outcomeYesWins: params.outcomeYesWins,
        programId,
      },
    });

    const signature = makeMockSignature('admin-settle');

    logger.info('adminSettle', `[STUB] Market admin-settled: ${params.marketAddress}`, {
      context: {
        signature,
        marketAddress: params.marketAddress,
        outcomeYesWins: params.outcomeYesWins,
      },
    });

    return signature;
  }

  return Object.freeze({ createStrikeMarket, settleMarket, adminSettle });
}

// ---------------------------------------------------------------------------
// Real Anchor implementation
// ---------------------------------------------------------------------------

/**
 * Create a real MeridianClient that builds Anchor instructions from the IDL
 * and submits them via the TransactionSender.
 */
export function createRealMeridianClient(deps: RealMeridianClientDeps): MeridianClient {
  const { transactionSender, connection, adminKeypair, usdcMint } = deps;
  const programPubkey = new PublicKey(deps.programId);

  // Create a read-only AnchorProvider (we sign manually via TransactionSender)
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: adminKeypair.publicKey,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    },
    { commitment: 'confirmed' },
  );

  const program = new Program(MeridianIDL as Idl, provider);

  // Validate that the IDL-embedded program address matches the runtime PROGRAM_ID
  if (program.programId.toBase58() !== programPubkey.toBase58()) {
    throw new MeridianError(
      MeridianErrorCode.RPC_ERROR,
      `PROGRAM_ID env var (${programPubkey.toBase58()}) does not match IDL address (${program.programId.toBase58()}). Update IDL or PROGRAM_ID.`,
    );
  }

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
      const strikePriceBN = new BN(params.strikePrice);
      const tradingDateBN = new BN(params.tradingDate);

      const [configPda] = deriveConfigPda(programPubkey);
      const [tickerConfigPda] = deriveTickerConfigPda(params.ticker, programPubkey);
      const [strikeMarketPda] = deriveStrikeMarketPda(
        params.ticker,
        strikePriceBN,
        tradingDateBN,
        programPubkey,
      );
      const [yesMintPda] = deriveYesMintPda(strikeMarketPda, programPubkey);
      const [noMintPda] = deriveNoMintPda(strikeMarketPda, programPubkey);
      const [vaultPda] = deriveVaultPda(strikeMarketPda, programPubkey);
      const phoenixMarket = new PublicKey(params.phoenixMarketAddress);

      debugLog('TX_BUILDING', 'meridian-client', 'createStrikeMarket', 'Deriving PDAs', {
        config: configPda.toBase58(),
        tickerConfig: tickerConfigPda.toBase58(),
        strikeMarket: strikeMarketPda.toBase58(),
        yesMint: yesMintPda.toBase58(),
        noMint: noMintPda.toBase58(),
        vault: vaultPda.toBase58(),
      });

      const instruction = await program.methods
        .createStrikeMarket(strikePriceBN, tradingDateBN)
        .accounts({
          admin: adminKeypair.publicKey,
          config: configPda,
          tickerConfig: tickerConfigPda,
          strikeMarket: strikeMarketPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          usdcMint,
          vault: vaultPda,
          phoenixMarket,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      const signature = await transactionSender.sendAndConfirm(instruction, [adminKeypair]);

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
      const strikeMarketPubkey = new PublicKey(params.marketAddress);
      const pythPriceAccount = new PublicKey(params.pythPriceAccount);

      // Fetch the strike market account to read its ticker for PDA derivation
      const strikeMarketAccount = await program.account['strikeMarket'].fetch(
        strikeMarketPubkey,
      );
      const ticker = (strikeMarketAccount as Record<string, unknown>)['ticker'] as string;

      const [configPda] = deriveConfigPda(programPubkey);
      const [tickerConfigPda] = deriveTickerConfigPda(ticker, programPubkey);

      debugLog('TX_BUILDING', 'meridian-client', 'settleMarket', 'Building settle instruction', {
        config: configPda.toBase58(),
        tickerConfig: tickerConfigPda.toBase58(),
        strikeMarket: strikeMarketPubkey.toBase58(),
        pythPriceAccount: pythPriceAccount.toBase58(),
      });

      const instruction = await program.methods
        .settleMarket()
        .accounts({
          settler: adminKeypair.publicKey,
          config: configPda,
          tickerConfig: tickerConfigPda,
          strikeMarket: strikeMarketPubkey,
          pythPriceAccount,
        })
        .instruction();

      const signature = await transactionSender.sendAndConfirm(instruction, [adminKeypair]);

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
      const strikeMarketPubkey = new PublicKey(params.marketAddress);

      // Fetch the strike market to determine settlement price (0 = placeholder for admin)
      const [configPda] = deriveConfigPda(programPubkey);

      debugLog('TX_BUILDING', 'meridian-client', 'adminSettle', 'Building admin settle instruction', {
        config: configPda.toBase58(),
        strikeMarket: strikeMarketPubkey.toBase58(),
        outcomeYesWins: params.outcomeYesWins,
      });

      // admin_settle takes (outcome_yes_wins: bool, settlement_price: u64)
      const instruction = await program.methods
        .adminSettle(params.outcomeYesWins, new BN(params.settlementPrice))
        .accounts({
          admin: adminKeypair.publicKey,
          config: configPda,
          strikeMarket: strikeMarketPubkey,
        })
        .instruction();

      const signature = await transactionSender.sendAndConfirm(instruction, [adminKeypair]);

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

// ---------------------------------------------------------------------------
// Legacy factory (kept for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Create a MeridianClient instance backed by the given dependencies.
 * This creates a stub client. For real usage, call createRealMeridianClient.
 *
 * @deprecated Use createStubMeridianClient or createRealMeridianClient directly.
 */
export function createMeridianClient(deps: MeridianClientDeps): MeridianClient {
  return createStubMeridianClient(deps);
}
