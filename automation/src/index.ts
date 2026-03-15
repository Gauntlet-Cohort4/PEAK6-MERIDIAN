/**
 * @module index
 * Entry point for the Meridian automation service.
 * Supports cron mode (default) and one-shot mode (for testing).
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import cron from 'node-cron';
import { Connection, Keypair } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { loadConfig, type AutomationConfig } from './config.js';
import { createPythHermesClient } from './services/pyth-hermes-client.js';
import { createTradingDayService } from './services/trading-day-service.js';
import { createDemoPriceService, createDemoTradingDayService } from './services/demo-mode.js';
import {
  createStubTransactionSender,
  createRealTransactionSender,
} from './services/transaction-sender.js';
import {
  createStubMeridianClient,
  createRealMeridianClient,
  type MeridianClient,
} from './services/meridian-client.js';
import { runMorningJob, type MorningJobDeps } from './jobs/morning-job.js';
import { runSettlementJob, type SettlementJobDeps } from './jobs/settlement-job.js';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('automation');

/** USDC mint addresses by network. */
const USDC_MINTS = {
  devnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
} as const;

/**
 * Load a Keypair from a JSON file containing a byte array.
 */
function loadKeypairFromFile(keypairPath: string): Keypair {
  try {
    const raw = readFileSync(keypairPath, 'utf-8');
    const bytes = JSON.parse(raw) as unknown;
    if (!Array.isArray(bytes) || bytes.length !== 64) {
      throw new Error(`Expected 64-byte array, got ${Array.isArray(bytes) ? bytes.length : typeof bytes}`);
    }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
  } catch (err) {
    throw new Error(`Failed to load admin keypair from '${keypairPath}': ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Build the MeridianClient based on demo mode flag.
 */
function buildMeridianClient(config: AutomationConfig): MeridianClient {
  if (config.demoMode) {
    const transactionSender = createStubTransactionSender();
    return createStubMeridianClient({
      transactionSender,
      programId: config.programId,
      adminKeypairPath: config.adminKeypairPath,
    });
  }

  const connection = new Connection(config.solanaRpcUrl, 'confirmed');
  const adminKeypair = loadKeypairFromFile(config.adminKeypairPath);
  const transactionSender = createRealTransactionSender({ connection });

  return createRealMeridianClient({
    transactionSender,
    programId: config.programId,
    adminKeypairPath: config.adminKeypairPath,
    connection,
    adminKeypair,
    usdcMint: config.solanaNetwork === 'mainnet-beta'
      ? USDC_MINTS.mainnet
      : USDC_MINTS.devnet,
  });
}

/**
 * Build service dependencies from configuration.
 */
function buildDeps(config: AutomationConfig): MorningJobDeps & SettlementJobDeps {
  const priceService = config.demoMode
    ? createDemoPriceService()
    : createPythHermesClient({
        hermesUrl: config.pythHermesUrl,
        benchmarksUrl: config.pythBenchmarksUrl,
      });

  const tradingDayService = config.demoMode
    ? createDemoTradingDayService()
    : createTradingDayService({ finnhubApiKey: config.finnhubApiKey });

  const meridianClient = buildMeridianClient(config);

  return { priceService, tradingDayService, meridianClient };
}

/**
 * Run in one-shot mode: execute both jobs immediately and exit.
 */
async function runOneShot(config: AutomationConfig): Promise<void> {
  logger.info('oneShot', 'Running in one-shot mode');
  const deps = buildDeps(config);

  const morningResult = await runMorningJob(deps);
  logger.info('oneShot', 'Morning job result', { context: { ...morningResult } });

  const settlementResult = await runSettlementJob(deps);
  logger.info('oneShot', 'Settlement job result', { context: { ...settlementResult } });
}

/**
 * Run in cron mode: schedule jobs according to configured schedules.
 */
function runCronMode(config: AutomationConfig): void {
  const deps = buildDeps(config);

  logger.info('cron', `Scheduling morning job: ${config.cronMorningSchedule}`, {
    context: { schedule: config.cronMorningSchedule, timezone: 'America/New_York' },
  });

  cron.schedule(
    config.cronMorningSchedule,
    async () => {
      try {
        await runMorningJob(deps);
      } catch (err) {
        logger.error('cron', 'Morning job failed', { error: err });
      }
    },
    { timezone: 'America/New_York' },
  );

  logger.info('cron', `Scheduling settlement job: ${config.cronSettlementSchedule}`, {
    context: { schedule: config.cronSettlementSchedule, timezone: 'America/New_York' },
  });

  cron.schedule(
    config.cronSettlementSchedule,
    async () => {
      try {
        await runSettlementJob(deps);
      } catch (err) {
        logger.error('cron', 'Settlement job failed', { error: err });
      }
    },
    { timezone: 'America/New_York' },
  );

  logger.info('cron', 'Automation service started in cron mode');
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const isOneShot = process.argv.includes('--one-shot');

    logger.info('main', 'Meridian Automation Service starting', {
      context: {
        demoMode: config.demoMode,
        oneShot: isOneShot,
      },
    });

    if (isOneShot) {
      await runOneShot(config);
    } else {
      runCronMode(config);
    }
  } catch (err) {
    logger.error('main', 'Automation service failed to start', { error: err });
    process.exit(1);
  }
}

main();
