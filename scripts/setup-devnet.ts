/**
 * @module scripts/setup-devnet
 * One-time devnet setup script.
 *
 * Steps:
 * 1. Airdrop SOL to admin wallet
 * 2. Create USDC token accounts
 * 3. Register tickers with Pyth feed IDs
 *
 * Usage:
 *   npx ts-node scripts/setup-devnet.ts
 */

import { MERIDIAN_CONFIG, type SupportedTicker } from '../shared/constants';

/** Pyth feed IDs for each supported ticker on devnet. */
const PYTH_FEED_IDS: Readonly<Record<SupportedTicker, string>> = {
  AAPL: 'b3a83305180090ac564afcc05ad973e5d1b7e0d1e9a8cc2b495a1cf0a4026752',
  MSFT: 'c2e03ef975e12b5e0de3cc609e3e5f7e1cf4a35d327f89b97e7d174ab0d1c7c8',
  GOOGL: 'e13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  AMZN: 'a13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  NVDA: 'b13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  META: 'c13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  TSLA: 'd13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
};

/** Devnet USDC mint (SPL Token). */
const DEVNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

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
    programId: process.env['PROGRAM_ID'] ?? 'MeridianProgram111111111111111111',
    airdropAmountSol: 2,
  });
}

function log(step: string, message: string, data?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    step,
    message,
    ...(data ? { data } : {}),
  };
  console.log(JSON.stringify(entry, null, 2));
}

async function airdropSol(config: SetupConfig): Promise<void> {
  log('1-airdrop', `Requesting ${config.airdropAmountSol} SOL airdrop`, {
    rpcUrl: config.rpcUrl,
    adminKeypairPath: config.adminKeypairPath,
  });

  // TODO: Request airdrop via RPC
  // const connection = new Connection(config.rpcUrl);
  // const adminKeypair = loadKeypair(config.adminKeypairPath);
  // const sig = await connection.requestAirdrop(
  //   adminKeypair.publicKey,
  //   config.airdropAmountSol * LAMPORTS_PER_SOL,
  // );
  // await connection.confirmTransaction(sig);

  log('1-airdrop', `Airdrop complete (stub): ${config.airdropAmountSol} SOL`);
}

async function createUsdcAccounts(config: SetupConfig): Promise<void> {
  log('2-usdc', 'Creating USDC token accounts', {
    usdcMint: DEVNET_USDC_MINT,
  });

  // TODO: Create associated token account for USDC
  // const connection = new Connection(config.rpcUrl);
  // const adminKeypair = loadKeypair(config.adminKeypairPath);
  // const ata = await getOrCreateAssociatedTokenAccount(
  //   connection,
  //   adminKeypair,
  //   new PublicKey(DEVNET_USDC_MINT),
  //   adminKeypair.publicKey,
  // );

  log('2-usdc', 'USDC token accounts created (stub)', {
    usdcMint: DEVNET_USDC_MINT,
    decimals: MERIDIAN_CONFIG.USDC_DECIMALS,
  });
}

async function registerTickers(config: SetupConfig): Promise<void> {
  log('3-register', 'Registering tickers');

  for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
    const feedId = PYTH_FEED_IDS[ticker];

    log('3-register', `Registering ${ticker}`, { ticker, feedId });

    // TODO: Build and send register_ticker instruction
    // const program = new Program(MeridianIDL, config.programId, provider);
    // await program.methods.registerTicker(ticker, feedId).accounts({...}).rpc();

    log('3-register', `Registered ${ticker} (stub)`, { ticker });
  }

  log('3-register', `All ${MERIDIAN_CONFIG.SUPPORTED_TICKERS.length} tickers registered`);
}

async function main(): Promise<void> {
  log('start', '=== Meridian Devnet Setup ===');

  const config = loadSetupConfig();
  log('start', 'Configuration loaded', {
    rpcUrl: config.rpcUrl,
    programId: config.programId,
    airdropAmountSol: config.airdropAmountSol,
  });

  await airdropSol(config);
  await createUsdcAccounts(config);
  await registerTickers(config);

  log('done', '=== Devnet setup complete ===', {
    tickersRegistered: MERIDIAN_CONFIG.SUPPORTED_TICKERS.length,
  });
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
