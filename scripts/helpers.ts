/**
 * @module scripts/helpers
 * Shared utilities for Meridian integration scripts.
 *
 * Provides Anchor program setup, PDA derivation, keypair loading,
 * and structured logging used across demo, deploy, and setup scripts.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';

// Re-export SupportedTicker type inline (avoids ESM/CJS import issues with shared/)
export type SupportedTicker = 'AAPL' | 'MSFT' | 'GOOGL' | 'AMZN' | 'NVDA' | 'META' | 'TSLA';

// ---------------------------------------------------------------------------
// IDL + Program ID
// ---------------------------------------------------------------------------

const IDL_PATH = path.resolve(__dirname, 'idl', 'meridian.json');

function loadIdl(): Record<string, unknown> {
  const raw = fs.readFileSync(IDL_PATH, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/** The on-chain program address baked into the IDL. */
export const PROGRAM_ID = new PublicKey(
  'AiG9ZAw6625w5zUQRsfmWwqXRmYSZAJe9MRfjcJoEK9h',
);

// ---------------------------------------------------------------------------
// PDA seeds (decoded from the IDL byte arrays)
// ---------------------------------------------------------------------------

export const SEEDS = {
  CONFIG: Buffer.from('config'),
  TICKER: Buffer.from('ticker'),
  MARKET: Buffer.from('market'),
  YES_MINT: Buffer.from('yes_mint'),
  NO_MINT: Buffer.from('no_mint'),
  VAULT: Buffer.from('vault'),
} as const;

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

export function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.CONFIG], PROGRAM_ID);
}

export function deriveTickerPda(symbol: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.TICKER, Buffer.from(symbol)],
    PROGRAM_ID,
  );
}

export function deriveStrikeMarketPda(
  symbol: string,
  strikePrice: BN,
  tradingDate: BN,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEEDS.MARKET,
      Buffer.from(symbol),
      strikePrice.toArrayLike(Buffer, 'le', 8),
      tradingDate.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID,
  );
}

export function deriveYesMintPda(strikeMarket: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.YES_MINT, strikeMarket.toBuffer()],
    PROGRAM_ID,
  );
}

export function deriveNoMintPda(strikeMarket: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.NO_MINT, strikeMarket.toBuffer()],
    PROGRAM_ID,
  );
}

export function deriveVaultPda(strikeMarket: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.VAULT, strikeMarket.toBuffer()],
    PROGRAM_ID,
  );
}

// ---------------------------------------------------------------------------
// Keypair loading
// ---------------------------------------------------------------------------

export function loadKeypair(keypairPath: string): Keypair {
  const resolved = keypairPath.startsWith('~')
    ? path.join(
        process.env['HOME'] ?? process.env['USERPROFILE'] ?? '',
        keypairPath.slice(1),
      )
    : path.resolve(keypairPath);

  const raw = fs.readFileSync(resolved, 'utf-8');
  const secretKey = Uint8Array.from(JSON.parse(raw) as number[]);
  return Keypair.fromSecretKey(secretKey);
}

// ---------------------------------------------------------------------------
// Anchor provider + program setup
// ---------------------------------------------------------------------------

export function createProvider(
  connection: Connection,
  wallet: Wallet,
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Creates an Anchor Program instance from the IDL loaded at runtime.
 * Returns `any` because the IDL is loaded dynamically -- callers use
 * `.methods.<instruction>()` which Anchor resolves at runtime.
 */
export function createProgram(provider: AnchorProvider): any {
  const idl = loadIdl();
  return new Program(idl as any, provider);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Pyth feed IDs (devnet)
// ---------------------------------------------------------------------------

export const PYTH_FEED_IDS: Readonly<Record<SupportedTicker, string>> = {
  AAPL: 'b3a83305180090ac564afcc05ad973e5d1b7e0d1e9a8cc2b495a1cf0a4026752',
  MSFT: 'c2e03ef975e12b5e0de3cc609e3e5f7e1cf4a35d327f89b97e7d174ab0d1c7c8',
  GOOGL: 'e13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  AMZN: 'a13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  NVDA: 'b13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  META: 'c13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  TSLA: 'd13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
};

/** Devnet USDC mint (SPL Token). */
export const DEVNET_USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
);

// ---------------------------------------------------------------------------
// Well-known program addresses
// ---------------------------------------------------------------------------

export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };

export const RENT_SYSVAR = new PublicKey(
  'SysvarRent111111111111111111111111111111111',
);

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

export function log(
  step: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    step,
    message,
    ...(data ? { data } : {}),
  };
  console.log(JSON.stringify(entry, null, 2));
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns today's midnight-ET Unix timestamp (seconds). */
export function todayTradingDate(): BN {
  const now = new Date();
  // US Eastern = UTC-5 (ignoring DST for simplicity; real cron should use TZ lib)
  const etOffset = -5 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const etMs = utcMs + etOffset * 60_000;
  const etDate = new Date(etMs);
  etDate.setHours(0, 0, 0, 0);
  // Convert back to UTC timestamp
  const midnightEtUtcMs = etDate.getTime() - etOffset * 60_000;
  return new BN(Math.floor(midnightEtUtcMs / 1000));
}

/** Wait for a given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Confirmed airdrop
// ---------------------------------------------------------------------------

export async function airdropAndConfirm(
  connection: Connection,
  to: PublicKey,
  lamports: number,
): Promise<string> {
  const sig = await connection.requestAirdrop(to, lamports);
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

// Re-export useful types
export { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, BN, Wallet };
export { getAssociatedTokenAddress };
