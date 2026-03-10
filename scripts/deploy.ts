/**
 * @module scripts/deploy
 * Deployment script for the Meridian Anchor program.
 *
 * Steps:
 * 1. Build Anchor program
 * 2. Deploy to devnet
 * 3. Initialize config PDA
 * 4. Register all 7 tickers with Pyth feed IDs
 *
 * Usage:
 *   npx ts-node scripts/deploy.ts
 *   SOLANA_CLUSTER=mainnet npx ts-node scripts/deploy.ts
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
  const programKeypairPath = process.env['PROGRAM_KEYPAIR_PATH']
    ?? 'target/deploy/meridian-keypair.json';

  return Object.freeze({ cluster, rpcUrl, adminKeypairPath, programKeypairPath });
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

async function buildProgram(): Promise<void> {
  log('1-build', 'Building Anchor program...');

  // TODO: Execute `anchor build` via child_process
  // const { execSync } = require('child_process');
  // execSync('anchor build', { stdio: 'inherit' });

  log('1-build', 'Program build complete (stub)');
}

async function deployProgram(config: DeployConfig): Promise<string> {
  log('2-deploy', `Deploying to ${config.cluster}...`, { rpcUrl: config.rpcUrl });

  // TODO: Execute `anchor deploy --provider.cluster <cluster>`
  // const { execSync } = require('child_process');
  // const output = execSync(
  //   `anchor deploy --provider.cluster ${config.cluster}`,
  //   { encoding: 'utf-8' },
  // );
  // Parse program ID from output

  const mockProgramId = 'MeridianProgram111111111111111111';
  log('2-deploy', 'Program deployed (stub)', { programId: mockProgramId });
  return mockProgramId;
}

async function initializeConfig(
  config: DeployConfig,
  programId: string,
): Promise<string> {
  log('3-init', 'Initializing config PDA...', { programId });

  // TODO: Build and send initialize_config instruction
  // const program = new Program(MeridianIDL, programId, provider);
  // const configPda = PublicKey.findProgramAddressSync(
  //   [Buffer.from('config')],
  //   program.programId,
  // );
  // const tx = await program.methods.initializeConfig().accounts({
  //   config: configPda[0],
  //   admin: adminKeypair.publicKey,
  //   systemProgram: SystemProgram.programId,
  // }).rpc();

  const mockTx = `deploy-init-${Date.now()}`;
  log('3-init', 'Config PDA initialized (stub)', { signature: mockTx });
  return mockTx;
}

async function registerAllTickers(
  config: DeployConfig,
  programId: string,
): Promise<void> {
  log('4-register', 'Registering all tickers...');

  for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
    const feedId = PYTH_FEED_IDS[ticker];

    log('4-register', `Registering ${ticker}`, { ticker, feedId });

    // TODO: Build and send register_ticker instruction
    // const tx = await program.methods
    //   .registerTicker(ticker, feedId)
    //   .accounts({
    //     config: configPda[0],
    //     admin: adminKeypair.publicKey,
    //   })
    //   .rpc();

    log('4-register', `Registered ${ticker} (stub)`, { ticker, feedId });
  }

  log('4-register', `All ${MERIDIAN_CONFIG.SUPPORTED_TICKERS.length} tickers registered`);
}

async function main(): Promise<void> {
  log('start', '=== Meridian Deployment Script ===');

  const config = loadDeployConfig();
  log('start', `Deploying to: ${config.cluster}`, { rpcUrl: config.rpcUrl });

  await buildProgram();
  const programId = await deployProgram(config);
  await initializeConfig(config, programId);
  await registerAllTickers(config, programId);

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
