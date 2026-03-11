/**
 * @module scripts/setup-devnet
 * One-time devnet setup script for Meridian.
 *
 * Steps:
 * 1. Airdrop SOL to admin wallet
 * 2. Create USDC associated token account for admin
 * 3. Register all 7 tickers with Pyth feed IDs
 *
 * Usage:
 *   npx ts-node scripts/setup-devnet.ts
 */

import {
  BN,
  Connection,
  Keypair,
  PublicKey,
  Wallet,
  LAMPORTS_PER_SOL,
  log,
  loadKeypair,
  createProvider,
  createProgram,
  airdropAndConfirm,
  deriveConfigPda,
  deriveTickerPda,
  sleep,
  PYTH_FEED_IDS,
  DEVNET_USDC_MINT,
  PROGRAM_ID,
  SystemProgram,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from './helpers';
import {
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';

/** Platform configuration mirrored from shared/constants. */
const MERIDIAN_CONFIG = {
  SUPPORTED_TICKERS: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] as const,
  USDC_DECIMALS: 6,
  INTER_TX_DELAY_MS: 500,
} as const;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface SetupConfig {
  readonly rpcUrl: string;
  readonly adminKeypairPath: string;
  readonly programId: string;
  readonly airdropAmountSol: number;
}

function loadSetupConfig(): SetupConfig {
  return Object.freeze({
    rpcUrl: process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com',
    adminKeypairPath: process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json',
    programId: process.env['PROGRAM_ID'] ?? PROGRAM_ID.toBase58(),
    airdropAmountSol: 2,
  });
}

// ---------------------------------------------------------------------------
// Step 1: Airdrop SOL
// ---------------------------------------------------------------------------

async function airdropSol(
  connection: Connection,
  admin: Keypair,
  amountSol: number,
): Promise<void> {
  log('1-airdrop', `Requesting ${amountSol} SOL airdrop`, {
    admin: admin.publicKey.toBase58(),
  });

  const balanceBefore = await connection.getBalance(admin.publicKey);
  log('1-airdrop', 'Balance before airdrop', {
    balanceSol: balanceBefore / LAMPORTS_PER_SOL,
  });

  // Airdrop in chunks (devnet has a 2 SOL per-request limit)
  const chunkSize = Math.min(amountSol, 2);
  const chunks = Math.ceil(amountSol / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const lamports = chunkSize * LAMPORTS_PER_SOL;
    const sig = await airdropAndConfirm(connection, admin.publicKey, lamports);
    log('1-airdrop', `Airdrop chunk ${i + 1}/${chunks} confirmed`, { signature: sig });

    if (i < chunks - 1) {
      await sleep(1000); // Rate limit
    }
  }

  const balanceAfter = await connection.getBalance(admin.publicKey);
  log('1-airdrop', `Airdrop complete`, {
    balanceSol: balanceAfter / LAMPORTS_PER_SOL,
  });
}

// ---------------------------------------------------------------------------
// Step 2: Create USDC Token Accounts
// ---------------------------------------------------------------------------

async function createUsdcAccounts(
  connection: Connection,
  admin: Keypair,
): Promise<void> {
  log('2-usdc', 'Creating USDC associated token account', {
    usdcMint: DEVNET_USDC_MINT.toBase58(),
  });

  const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, admin.publicKey);

  // Check if the ATA already exists
  const accountInfo = await connection.getAccountInfo(ata);
  if (accountInfo !== null) {
    log('2-usdc', 'USDC ATA already exists, skipping', {
      ata: ata.toBase58(),
    });
    return;
  }

  const ix = createAssociatedTokenAccountInstruction(
    admin.publicKey,      // payer
    ata,                  // associatedToken
    admin.publicKey,      // owner
    DEVNET_USDC_MINT,     // mint
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.sign(admin);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');

  log('2-usdc', 'USDC ATA created', {
    signature: sig,
    ata: ata.toBase58(),
    decimals: MERIDIAN_CONFIG.USDC_DECIMALS,
  });
}

// ---------------------------------------------------------------------------
// Step 3: Register Tickers
// ---------------------------------------------------------------------------

async function registerTickers(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  admin: Keypair,
): Promise<void> {
  log('3-register', 'Registering tickers');

  const [configPda] = deriveConfigPda();

  for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
    const feedIdHex = PYTH_FEED_IDS[ticker];
    const feedIdPubkey = new PublicKey(Buffer.from(feedIdHex, 'hex'));
    const [tickerPda] = deriveTickerPda(ticker);

    log('3-register', `Registering ${ticker}`, {
      ticker,
      feedId: feedIdHex,
      tickerPda: tickerPda.toBase58(),
    });

    // Check if already registered
    try {
      const existing = await program.account['tickerConfig'].fetch(tickerPda);
      if (existing) {
        log('3-register', `Ticker already registered: ${ticker}`, {
          tickerPda: tickerPda.toBase58(),
        });
        continue;
      }
    } catch {
      // Not found, register
    }

    const tx = await program.methods
      .registerTicker(ticker, feedIdPubkey)
      .accountsStrict({
        admin: admin.publicKey,
        config: configPda,
        tickerConfig: tickerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    log('3-register', `Registered ${ticker}`, { signature: tx });
    await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
  }

  log('3-register', `All ${MERIDIAN_CONFIG.SUPPORTED_TICKERS.length} tickers registered`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('start', '=== Meridian Devnet Setup ===');

  const config = loadSetupConfig();
  log('start', 'Configuration loaded', {
    rpcUrl: config.rpcUrl,
    programId: config.programId,
    airdropAmountSol: config.airdropAmountSol,
  });

  const connection = new Connection(config.rpcUrl, 'confirmed');
  const admin = loadKeypair(config.adminKeypairPath);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  log('start', 'Admin wallet loaded', {
    admin: admin.publicKey.toBase58(),
  });

  // Step 1: Airdrop SOL
  await airdropSol(connection, admin, config.airdropAmountSol);

  // Step 2: Create USDC token accounts
  await createUsdcAccounts(connection, admin);

  // Step 3: Register tickers
  await registerTickers(program, admin);

  log('done', '=== Devnet setup complete ===', {
    tickersRegistered: MERIDIAN_CONFIG.SUPPORTED_TICKERS.length,
  });
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
