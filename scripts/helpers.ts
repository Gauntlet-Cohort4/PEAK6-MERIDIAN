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
  'DkF63Re3EouN699gE3NvEnE1t7PuGC8UrYQEsbRAkEvE',
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
  AAPL: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  MSFT: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  GOOGL: '5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
  AMZN: 'b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
  NVDA: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  META: '78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  TSLA: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
};

/** Devnet USDC mint (SPL Token faucet). */
export const DEVNET_USDC_MINT = new PublicKey(
  'DZSY3GVoKSzMMh1vePZdgHsMavPyhB9dEGDjVtqHSYro',
);

/** Mainnet USDC mint (Circle-issued). */
export const MAINNET_USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
);

/** Get USDC mint based on cluster. */
export function getUsdcMint(cluster: string = 'devnet'): PublicKey {
  return cluster === 'mainnet-beta' || cluster === 'mainnet'
    ? MAINNET_USDC_MINT
    : DEVNET_USDC_MINT;
}

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

/** Returns today's midnight-ET Unix timestamp (seconds), DST-aware. */
export function todayTradingDate(): BN {
  // Use Intl to get the correct ET date string (handles DST automatically)
  const etDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  // etDateStr is "YYYY-MM-DD", parse as midnight ET
  const [year, month, day] = etDateStr.split('-').map(Number);
  // Create a Date at midnight ET by finding the UTC offset for that date
  const midnightET = new Date(
    new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-05:00`).getTime(),
  );
  // Correct for DST: check if the ET timezone is actually -04:00 (EDT)
  const etOffsetCheck = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(midnightET).find(p => p.type === 'timeZoneName')?.value;
  const isEDT = etOffsetCheck?.includes('-4') ?? false;
  const midnightUTC = new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00${isEDT ? '-04:00' : '-05:00'}`,
  );
  return new BN(Math.floor(midnightUTC.getTime() / 1000));
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
