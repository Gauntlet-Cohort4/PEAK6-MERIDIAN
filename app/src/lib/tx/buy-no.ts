/**
 * @module tx/buy-no
 * Build a buy_no_market transaction that purchases NO tokens.
 *
 * On-chain, buy_no_market is a composite instruction:
 *   1. Mint YES+NO pair (depositing USDC)
 *   2. Sell YES at market on Phoenix
 *   3. User keeps the NO tokens
 */

import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
import {
  getMeridianProgram,
  deriveConfigPda,
  deriveYesMintPda,
  deriveNoMintPda,
  deriveVaultPda,
  deriveAta,
  TOKEN_PROGRAM_ID,
  PHOENIX_PROGRAM_ID,
  USDC_MINT,
} from './program';
import type {
  BuyNoParams,
  WalletConnection,
  BuildTransactionResult,
  UnsignedTransaction,
  MarketAccounts,
} from './types';

/**
 * Validate buy NO parameters before building the transaction.
 */
function validateBuyNoParams(params: BuyNoParams): void {
  if (!params.marketAddress || params.marketAddress.length === 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Market address is required for buy_no',
    );
  }

  if (params.maxUsdc <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Max USDC must be greater than zero',
      undefined,
      { maxUsdc: params.maxUsdc },
    );
  }
}

/**
 * Build a buy_no_market transaction (sync stub).
 *
 * @deprecated Use buildBuyNoInstruction() instead. This sync version produces
 * a stub with recentBlockhash='FETCH_VIA_CONNECTION' that cannot be submitted
 * directly. It exists only for offline account derivation / UI previews.
 */
export function buildBuyNoTransaction(
  params: BuyNoParams,
  wallet: WalletConnection,
  marketAccounts?: MarketAccounts,
): BuildTransactionResult {
  validateBuyNoParams(params);

  debugLog('TX_BUILDING', 'buy-no', 'build', 'Building buy_no_market transaction', {
    marketAddress: params.marketAddress,
    maxUsdc: params.maxUsdc,
    wallet: wallet.publicKey,
  });

  const userPubkey = new PublicKey(wallet.publicKey);
  const strikeMarket = new PublicKey(params.marketAddress);

  // Derive PDAs
  const [configPda] = deriveConfigPda();
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  // User ATAs
  const userUsdc = deriveAta(userPubkey, USDC_MINT);
  const userNo = deriveAta(userPubkey, noMint);

  // Amount in base units (the on-chain instruction takes pair count, not USDC)
  const amount = Math.floor(params.maxUsdc);

  const program = getMeridianProgram();

  // Build the accounts list for the sync interface
  const accounts = [
    { pubkey: userPubkey.toBase58(), isSigner: true, isWritable: true },
    { pubkey: configPda.toBase58(), isSigner: false, isWritable: false },
    { pubkey: strikeMarket.toBase58(), isSigner: false, isWritable: true },
    { pubkey: yesMint.toBase58(), isSigner: false, isWritable: true },
    { pubkey: noMint.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userUsdc.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userNo.toBase58(), isSigner: false, isWritable: true },
    // PDA-owned accounts — need MarketAccounts for these
    {
      pubkey: marketAccounts?.pdaYesAccount.toBase58() ?? deriveAta(strikeMarket, yesMint).toBase58(),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: marketAccounts?.pdaQuoteAccount.toBase58() ?? deriveAta(strikeMarket, USDC_MINT).toBase58(),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: vault.toBase58(), isSigner: false, isWritable: true },
    { pubkey: PHOENIX_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
    {
      pubkey: marketAccounts?.phoenixMarket.toBase58() ?? PublicKey.default.toBase58(),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: marketAccounts?.phoenixBaseVault.toBase58() ?? PublicKey.default.toBase58(),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: marketAccounts?.phoenixQuoteVault.toBase58() ?? PublicKey.default.toBase58(),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
  ];

  const stubInstruction = {
    programId: program.programId.toBase58(),
    keys: accounts,
    data: encodeBuyNoData(amount),
  };

  const transaction: UnsignedTransaction = {
    instructions: [stubInstruction],
    feePayer: wallet.publicKey,
    recentBlockhash: 'FETCH_VIA_CONNECTION',
  };

  return Object.freeze({
    transaction,
    estimatedFee: 5000,
  });
}

/**
 * Async version that returns a fully built Anchor TransactionInstruction.
 */
export async function buildBuyNoInstruction(
  params: BuyNoParams,
  walletPubkey: PublicKey,
  marketAccounts: MarketAccounts,
): Promise<import('@solana/web3.js').TransactionInstruction> {
  validateBuyNoParams(params);

  const strikeMarket = marketAccounts.strikeMarket;
  const [configPda] = deriveConfigPda();
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  const usdcMint = marketAccounts.usdcMint;
  const userUsdc = deriveAta(walletPubkey, usdcMint);
  const userNo = deriveAta(walletPubkey, noMint);

  const amount = Math.floor(params.maxUsdc);
  const program = getMeridianProgram();

  return program.methods
    .buyNoMarket(new BN(amount))
    .accountsPartial({
      user: walletPubkey,
      config: configPda,
      strikeMarket,
      yesMint,
      noMint,
      userUsdc,
      userNo,
      pdaYesAccount: marketAccounts.pdaYesAccount,
      pdaQuoteAccount: marketAccounts.pdaQuoteAccount,
      vault,
      phoenixProgram: PHOENIX_PROGRAM_ID,
      phoenixMarket: marketAccounts.phoenixMarket,
      phoenixBaseVault: marketAccounts.phoenixBaseVault,
      phoenixQuoteVault: marketAccounts.phoenixQuoteVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/** Encode buy_no_market instruction data: 8-byte discriminator + u64 amount. */
function encodeBuyNoData(amount: number): Uint8Array {
  // Discriminator from IDL: [72, 172, 24, 220, 176, 181, 13, 217]
  const discriminator = [72, 172, 24, 220, 176, 181, 13, 217];
  const amountBytes = new BN(amount).toArray('le', 8);
  return new Uint8Array([...discriminator, ...amountBytes]);
}
