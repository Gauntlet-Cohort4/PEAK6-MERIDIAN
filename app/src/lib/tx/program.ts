/**
 * @module tx/program
 * Anchor program instantiation and PDA derivation helpers.
 *
 * This module lazily creates an Anchor Program instance that can be
 * used by all transaction builders. It uses a dummy Connection because
 * we only need the instruction-building capabilities, not RPC calls.
 *
 * All PDA seeds mirror the Rust constants in programs/meridian/src/constants.rs.
 */

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { MeridianIDL, MERIDIAN_PROGRAM_ID } from '../idl';

// ── Seed constants (must match Rust constants.rs) ──────────────────────

export const SEEDS = {
  CONFIG: Buffer.from('config'),
  TICKER: Buffer.from('ticker'),
  MARKET: Buffer.from('market'),
  YES_MINT: Buffer.from('yes_mint'),
  NO_MINT: Buffer.from('no_mint'),
  VAULT: Buffer.from('vault'),
} as const;

// ── Well-known program addresses ───────────────────────────────────────

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export const PHOENIX_PROGRAM_ID = new PublicKey(
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
);

export const SYSTEM_PROGRAM_ID = new PublicKey(
  '11111111111111111111111111111111',
);

/**
 * USDC mint address. Uses NEXT_PUBLIC_USDC_MINT env var if set,
 * otherwise defaults to devnet USDC.
 */
export const USDC_MINT = new PublicKey(
  typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_USDC_MINT']
    ? process.env['NEXT_PUBLIC_USDC_MINT']
    : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
);

// ── Program singleton ──────────────────────────────────────────────────

let _program: Program | null = null;

/**
 * Return a singleton Anchor Program instance.
 *
 * The provider uses a lightweight read-only connection (no wallet signing
 * happens here — signing is deferred to the wallet adapter). We only need
 * the Program for `.methods.*.instruction()` calls.
 *
 * @param rpcUrl - Optional RPC URL override (defaults to devnet).
 */
export function getMeridianProgram(rpcUrl?: string): Program {
  if (_program !== null) {
    return _program;
  }

  const defaultRpc = typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_SOLANA_RPC_URL']
    ? process.env['NEXT_PUBLIC_SOLANA_RPC_URL']
    : 'https://api.devnet.solana.com';

  const connection = new Connection(
    rpcUrl ?? defaultRpc,
    'confirmed',
  );

  // Read-only provider (no wallet — instructions are unsigned at build time)
  const provider = new AnchorProvider(
    connection,
    // Dummy wallet — satisfies the type but is never used for signing
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    } as never,
    { commitment: 'confirmed' },
  );

  _program = new Program(MeridianIDL, provider);

  return _program;
}

/** Return the Meridian program ID as a PublicKey. */
export function getProgramId(): PublicKey {
  return new PublicKey(MERIDIAN_PROGRAM_ID);
}

// ── PDA derivation helpers ─────────────────────────────────────────────

/** Derive the global config PDA: seeds = ["config"]. */
export function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.CONFIG],
    getProgramId(),
  );
}

/** Derive a YES mint PDA: seeds = ["yes_mint", strikeMarket]. */
export function deriveYesMintPda(strikeMarket: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.YES_MINT, strikeMarket.toBuffer()],
    getProgramId(),
  );
}

/** Derive a NO mint PDA: seeds = ["no_mint", strikeMarket]. */
export function deriveNoMintPda(strikeMarket: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.NO_MINT, strikeMarket.toBuffer()],
    getProgramId(),
  );
}

/** Derive a vault PDA: seeds = ["vault", strikeMarket]. */
export function deriveVaultPda(strikeMarket: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.VAULT, strikeMarket.toBuffer()],
    getProgramId(),
  );
}

/**
 * Derive the Associated Token Account address for a given wallet + mint.
 * This replicates the standard ATA derivation without needing spl-token.
 */
export function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/**
 * Encode a u64 as a little-endian 8-byte Buffer (for PDA seed usage).
 */
export function u64ToLeBytes(value: BN | number | bigint): Buffer {
  const bn = typeof value === 'number' || typeof value === 'bigint'
    ? new BN(value.toString())
    : value;
  return bn.toArrayLike(Buffer, 'le', 8);
}

/**
 * Encode an i64 as a little-endian 8-byte Buffer (for PDA seed usage).
 */
export function i64ToLeBytes(value: BN | number | bigint): Buffer {
  const bn = typeof value === 'number' || typeof value === 'bigint'
    ? new BN(value.toString())
    : value;
  return bn.toArrayLike(Buffer, 'le', 8);
}
