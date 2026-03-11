/**
 * @module tx/sell-no
 * Build a sell_no transaction that sells NO tokens.
 *
 * On-chain, sell_no is a composite instruction:
 *   1. Buy YES on Phoenix (using USDC from PDA quote account)
 *   2. Burn YES + NO pair to redeem USDC from the vault
 *   3. User gets USDC back
 */

import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { MeridianError, MeridianErrorCode } from '@meridian/shared/errors';
import { debugLog } from '@meridian/shared/debug';
import {
  getMeridianProgram,
  deriveYesMintPda,
  deriveNoMintPda,
  deriveVaultPda,
  deriveAta,
  TOKEN_PROGRAM_ID,
  PHOENIX_PROGRAM_ID,
  USDC_MINT,
} from './program';
import type {
  SellNoParams,
  WalletConnection,
  BuildTransactionResult,
  UnsignedTransaction,
  MarketAccounts,
} from './types';

/**
 * Validate sell NO parameters before building the transaction.
 */
function validateSellNoParams(params: SellNoParams): void {
  if (!params.marketAddress || params.marketAddress.length === 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Market address is required for sell_no',
    );
  }
}

/**
 * Build a sell_no transaction (sync stub).
 *
 * @deprecated Use buildSellNoInstruction() instead. This sync version produces
 * a stub with recentBlockhash='FETCH_VIA_CONNECTION' that cannot be submitted
 * directly. It exists only for offline account derivation / UI previews.
 */
export function buildSellNoTransaction(
  params: SellNoParams,
  wallet: WalletConnection,
  marketAccounts?: MarketAccounts,
): BuildTransactionResult {
  validateSellNoParams(params);

  debugLog('TX_BUILDING', 'sell-no', 'build', 'Building sell_no transaction', {
    marketAddress: params.marketAddress,
    wallet: wallet.publicKey,
  });

  const userPubkey = new PublicKey(wallet.publicKey);
  const strikeMarket = new PublicKey(params.marketAddress);

  // Derive PDAs
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  const userUsdc = deriveAta(userPubkey, USDC_MINT);
  const userNo = deriveAta(userPubkey, noMint);

  if (params.amount === undefined || params.amount <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Amount is required and must be greater than zero for sell_no',
    );
  }
  const amount = params.amount;

  const program = getMeridianProgram();

  const accounts = [
    { pubkey: userPubkey.toBase58(), isSigner: true, isWritable: true },
    { pubkey: strikeMarket.toBase58(), isSigner: false, isWritable: true },
    { pubkey: yesMint.toBase58(), isSigner: false, isWritable: true },
    { pubkey: noMint.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userUsdc.toBase58(), isSigner: false, isWritable: true },
    { pubkey: userNo.toBase58(), isSigner: false, isWritable: true },
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
    data: encodeSellNoData(amount),
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
export async function buildSellNoInstruction(
  params: SellNoParams,
  walletPubkey: PublicKey,
  marketAccounts: MarketAccounts,
): Promise<import('@solana/web3.js').TransactionInstruction> {
  validateSellNoParams(params);

  const strikeMarket = marketAccounts.strikeMarket;
  const [yesMint] = deriveYesMintPda(strikeMarket);
  const [noMint] = deriveNoMintPda(strikeMarket);
  const [vault] = deriveVaultPda(strikeMarket);

  const userUsdc = deriveAta(walletPubkey, marketAccounts.usdcMint);
  const userNo = deriveAta(walletPubkey, noMint);

  if (params.amount === undefined || params.amount <= 0) {
    throw new MeridianError(
      MeridianErrorCode.TRANSACTION_REJECTED,
      'Amount is required and must be greater than zero for sell_no',
    );
  }
  const program = getMeridianProgram();

  return program.methods
    .sellNo(new BN(params.amount))
    .accountsPartial({
      user: walletPubkey,
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

/** Encode sell_no instruction data: 8-byte discriminator + u64 amount. */
function encodeSellNoData(amount: number): Uint8Array {
  // Discriminator from IDL: [189, 194, 132, 42, 80, 249, 154, 103]
  const discriminator = [189, 194, 132, 42, 80, 249, 154, 103];
  const amountBytes = new BN(amount).toArray('le', 8);
  return new Uint8Array([...discriminator, ...amountBytes]);
}
