/**
 * @module scripts/deploy
 * Deployment script for the Meridian Anchor program.
 *
 * Steps:
 * 1. Build Anchor program (`anchor build`)
 * 2. Deploy to target cluster (`anchor deploy`)
 * 3. Initialize config PDA via on-chain instruction
 * 4. Register all 7 tickers with Pyth feed IDs
 *
 * Usage:
 *   npx ts-node scripts/deploy.ts
 *   SOLANA_CLUSTER=mainnet npx ts-node scripts/deploy.ts
 */

import { execSync } from 'child_process';
import {
  BN,
  Connection,
  PublicKey,
  Wallet,
  log,
  loadKeypair,
  createProvider,
  createProgram,
  deriveConfigPda,
  deriveTickerPda,
  PYTH_FEED_IDS,
  PROGRAM_ID,
  SystemProgram,
  sleep,
} from './helpers';

/** Platform configuration mirrored from shared/constants. */
const MERIDIAN_CONFIG = {
  SUPPORTED_TICKERS: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] as const,
  INTER_TX_DELAY_MS: 500,
} as const;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface DeployConfig {
  readonly cluster: string;
  readonly rpcUrl: string;
  readonly adminKeypairPath: string;
  readonly programKeypairPath: string;
}

function loadDeployConfig(): DeployConfig {
  const cluster = process.env['SOLANA_CLUSTER'] ?? 'devnet';
  const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
  const adminKeypairPath = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';
  const programKeypairPath =
    process.env['PROGRAM_KEYPAIR_PATH'] ?? 'target/deploy/meridian-keypair.json';

  return Object.freeze({ cluster, rpcUrl, adminKeypairPath, programKeypairPath });
}

// ---------------------------------------------------------------------------
// Step 1: Build
// ---------------------------------------------------------------------------

function buildProgram(): void {
  log('1-build', 'Building Anchor program...');

  try {
    execSync('anchor build', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    log('1-build', 'Program build complete');
  } catch (err) {
    log('1-build', 'Build failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error('anchor build failed');
  }
}

// ---------------------------------------------------------------------------
// Step 2: Deploy
// ---------------------------------------------------------------------------

function deployProgram(config: DeployConfig): string {
  log('2-deploy', `Deploying to ${config.cluster}...`, { rpcUrl: config.rpcUrl });

  try {
    const output = execSync(
      `anchor deploy --provider.cluster ${config.rpcUrl} --provider.wallet ${config.adminKeypairPath}`,
      {
        encoding: 'utf-8',
        cwd: process.cwd(),
      },
    );

    // Parse program ID from anchor deploy output
    const match = output.match(/Program Id:\s*([A-Za-z0-9]+)/);
    const programId = match ? match[1] : PROGRAM_ID.toBase58();

    log('2-deploy', 'Program deployed', { programId, output: output.trim() });
    return programId ?? PROGRAM_ID.toBase58();
  } catch (err) {
    log('2-deploy', 'Deploy failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error('anchor deploy failed');
  }
}

// ---------------------------------------------------------------------------
// Step 3: Initialize Config
// ---------------------------------------------------------------------------

async function initializeConfig(program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, admin: ReturnType<typeof loadKeypair>): Promise<string> {
  log('3-init', 'Initializing config PDA...');

  const [configPda] = deriveConfigPda();

  // Check if already initialized
  try {
    const existing = await program.account['meridianConfig'].fetch(configPda);
    if (existing) {
      log('3-init', 'Config already initialized, skipping', {
        configPda: configPda.toBase58(),
      });
      return 'already-initialized';
    }
  } catch {
    // Not found, proceed
  }

  const tx = await program.methods
    .initializeConfig()
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();

  log('3-init', 'Config PDA initialized', {
    signature: tx,
    configPda: configPda.toBase58(),
  });
  return tx;
}

// ---------------------------------------------------------------------------
// Step 4: Register All Tickers
// ---------------------------------------------------------------------------

async function registerAllTickers(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  admin: ReturnType<typeof loadKeypair>,
): Promise<void> {
  log('4-register', 'Registering all tickers...');

  const [configPda] = deriveConfigPda();

  for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
    const feedIdHex = PYTH_FEED_IDS[ticker];
    const feedIdPubkey = new PublicKey(Buffer.from(feedIdHex, 'hex'));
    const [tickerPda] = deriveTickerPda(ticker);

    log('4-register', `Registering ${ticker}`, {
      ticker,
      feedId: feedIdHex,
      tickerPda: tickerPda.toBase58(),
    });

    // Check if already registered
    try {
      const existing = await program.account['tickerConfig'].fetch(tickerPda);
      if (existing) {
        log('4-register', `Ticker already registered: ${ticker}`, {
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

    log('4-register', `Registered ${ticker}`, { signature: tx });
    await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
  }

  log('4-register', `All ${MERIDIAN_CONFIG.SUPPORTED_TICKERS.length} tickers registered`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('start', '=== Meridian Deployment Script ===');

  const config = loadDeployConfig();
  log('start', `Deploying to: ${config.cluster}`, { rpcUrl: config.rpcUrl });

  // Step 1: Build
  buildProgram();

  // Step 2: Deploy
  const programId = deployProgram(config);

  // Step 3+4: Initialize config + register tickers via Anchor Program
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const admin = loadKeypair(config.adminKeypairPath);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  await initializeConfig(program, admin);
  await registerAllTickers(program, admin);

  log('done', '=== Deployment complete ===', {
    cluster: config.cluster,
    programId,
    tickersRegistered: MERIDIAN_CONFIG.SUPPORTED_TICKERS.length,
  });
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
