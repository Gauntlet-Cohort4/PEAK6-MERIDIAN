/**
 * @module config
 * Environment validation and configuration loading for the automation service.
 * Uses zod for schema validation with fail-fast behavior.
 */

import { z } from 'zod';
import { Logger } from '@meridian/shared/logger.js';

const logger = new Logger('automation-config');

/** Zod schema for automation environment variables. */
const configSchema = z.object({
  solanaRpcUrl: z
    .string()
    .min(1, 'SOLANA_RPC_URL is required'),
  pythHermesUrl: z
    .string()
    .url()
    .default('https://hermes.pyth.network'),
  pythBenchmarksUrl: z
    .string()
    .url()
    .default('https://benchmarks.pyth.network'),
  finnhubApiKey: z
    .string()
    .min(1, 'FINNHUB_API_KEY is required'),
  adminKeypairPath: z
    .string()
    .min(1, 'ADMIN_KEYPAIR_PATH is required'),
  programId: z
    .string()
    .min(1, 'PROGRAM_ID is required'),
  solanaNetwork: z
    .enum(['devnet', 'mainnet-beta'])
    .default('devnet'),
  demoMode: z
    .boolean()
    .default(false),
  cronMorningSchedule: z
    .string()
    .default('0 8 * * 1-5'),
  cronSettlementSchedule: z
    .string()
    .default('5 16 * * 1-5'),
  alertWebhookUrl: z
    .string()
    .url()
    .optional(),
});

/** Validated automation configuration. */
export type AutomationConfig = Readonly<z.infer<typeof configSchema>>;

/**
 * Parse a boolean-like environment variable string.
 * Returns true only for 'true' or '1'.
 */
function parseBoolEnv(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/**
 * Load and validate configuration from environment variables.
 * Throws with clear error messages if required variables are missing.
 */
export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AutomationConfig {
  const raw = {
    solanaRpcUrl: env['SOLANA_RPC_URL'],
    pythHermesUrl: env['PYTH_HERMES_URL'],
    pythBenchmarksUrl: env['PYTH_BENCHMARKS_URL'],
    finnhubApiKey: env['FINNHUB_API_KEY'],
    adminKeypairPath: env['ADMIN_KEYPAIR_PATH'],
    programId: env['PROGRAM_ID'],
    solanaNetwork: env['SOLANA_NETWORK'],
    demoMode: parseBoolEnv(env['DEMO_MODE']),
    cronMorningSchedule: env['CRON_MORNING_SCHEDULE'],
    cronSettlementSchedule: env['CRON_SETTLEMENT_SCHEDULE'],
    alertWebhookUrl: env['MERIDIAN_ALERT_WEBHOOK_URL'] || undefined,
  };

  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    const message = `Configuration validation failed:\n${errors}`;
    logger.error('loadConfig', message);
    throw new Error(message);
  }

  logger.info('loadConfig', 'Configuration loaded successfully', {
    context: {
      demoMode: result.data.demoMode,
      pythHermesUrl: result.data.pythHermesUrl,
      cronMorningSchedule: result.data.cronMorningSchedule,
      cronSettlementSchedule: result.data.cronSettlementSchedule,
    },
  });

  return Object.freeze(result.data);
}
