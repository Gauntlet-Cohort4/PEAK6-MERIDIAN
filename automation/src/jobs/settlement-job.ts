/**
 * @module settlement-job
 * Settlement job orchestration: settles markets using oracle prices.
 * On-chain calls are stubbed for Stage A.
 */

import type { PriceServiceAdapter, TradingDayAdapter } from '@meridian/shared/adapters/types.js';
import type { MeridianClient } from '../services/meridian-client.js';
import type { AlertService } from '../services/alert-service.js';
import type { ActiveMarket } from '../types/active-market.js';
import { MERIDIAN_CONFIG, PYTH_FEED_IDS, type SupportedTicker } from '@meridian/shared/constants.js';
import { Logger } from '@meridian/shared/logger.js';
import { debugLog } from '@meridian/shared/debug.js';
import { startTrace, traceElapsed } from '@meridian/shared/tracing.js';
import { withRetry } from '../utils/retry.js';

/** Maximum retry attempts for settlement (30 * 30s = 15 minutes). */
const SETTLEMENT_MAX_ATTEMPTS = 30;
/** Fixed retry interval for settlement in milliseconds. */
const SETTLEMENT_RETRY_INTERVAL_MS = 30_000;

const logger = new Logger('settlement-job');


/** Dependencies injected into the settlement job. */
export interface SettlementJobDeps {
  readonly priceService: PriceServiceAdapter;
  readonly tradingDayService: TradingDayAdapter;
  readonly meridianClient: MeridianClient;
  readonly alertService: AlertService;
}

/** Summary of the settlement job execution. */
export interface SettlementJobSummary {
  readonly marketsSettled: number;
  readonly adminSettleScheduled: number;
  readonly failures: readonly string[];
  readonly skipped: boolean;
  readonly durationMs: number;
}

// ActiveMarket type is re-exported from the shared types module.
export type { ActiveMarket } from '../types/active-market.js';

/**
 * Settle a single market using the oracle price.
 * Falls back to scheduling admin settlement if oracle is unavailable.
 */
async function settleMarket(
  market: ActiveMarket,
  deps: SettlementJobDeps,
): Promise<{ settled: boolean; adminScheduled: boolean; error?: string }> {
  const feedId = PYTH_FEED_IDS[market.ticker];
  if (!feedId) {
    return { settled: false, adminScheduled: true, error: `No Hermes feed ID for ticker ${market.ticker}` };
  }

  try {
    // Retry oracle fetch + settlement for up to 15 minutes (30 attempts * 30s)
    const result = await withRetry(
      async () => {
        const priceData = await deps.priceService.getLatestPrice(feedId);

        debugLog('CRON_JOBS', 'settlement-job', 'settleMarket', 'Oracle price fetched', {
          ticker: market.ticker,
          price: priceData.price,
          strikePrice: market.strikePrice,
        });

        const signature = await deps.meridianClient.settleMarket({
          marketAddress: market.marketAddress,
          pythPriceAccount: market.pythPriceAccount,
        });

        return { priceData, signature };
      },
      {
        maxAttempts: SETTLEMENT_MAX_ATTEMPTS,
        initialDelayMs: SETTLEMENT_RETRY_INTERVAL_MS,
        maxDelayMs: SETTLEMENT_RETRY_INTERVAL_MS, // Fixed interval, not exponential
        backoffMultiplier: 1, // Fixed delay (not exponential)
        operationName: `settleMarket(${market.ticker}@$${market.strikePrice})`,
      },
    );

    logger.info('settleMarket', `Settled ${market.ticker} @ $${market.strikePrice}`, {
      context: {
        ticker: market.ticker,
        strikePrice: market.strikePrice,
        settlementPrice: result.priceData.price,
        marketAddress: market.marketAddress,
        outcome: result.priceData.price >= market.strikePrice ? 'YES' : 'NO',
        signature: result.signature,
      },
    });

    return { settled: true, adminScheduled: false };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn('settleMarket', `Oracle failed for ${market.ticker} after ${SETTLEMENT_MAX_ATTEMPTS} attempts, scheduling admin settle`, {
      error: err,
      context: {
        ticker: market.ticker,
        delaySeconds: MERIDIAN_CONFIG.ADMIN_SETTLE_DELAY_SECONDS,
      },
    });

    // Oracle failed after 15 minutes of retries — do NOT auto-settle with a guessed outcome.
    // Leave the market unsettled for manual admin intervention.
    logger.error('settleMarket', `Oracle unavailable for ${market.ticker}; manual admin settlement required`, {
      context: {
        ticker: market.ticker,
        marketAddress: market.marketAddress,
      },
    });

    // Alert admin for manual override
    await deps.alertService.sendAlert('critical', 'Oracle Settlement Failed', {
      marketAddress: market.marketAddress,
      ticker: market.ticker,
      attempts: SETTLEMENT_MAX_ATTEMPTS,
      lastError: errorMsg,
    });

    return { settled: false, adminScheduled: true, error: errorMsg };
  }
}

/**
 * Execute the settlement job: check trading day, settle all active markets.
 *
 * When `activeMarkets` is not provided, queries on-chain via
 * `deps.meridianClient.getActiveMarkets()`.
 */
export async function runSettlementJob(
  deps: SettlementJobDeps,
  activeMarkets?: readonly ActiveMarket[],
  now: Date = new Date(),
): Promise<SettlementJobSummary> {
  const trace = startTrace('settlement-job');
  logger.info('runSettlementJob', 'Settlement job started', {
    context: { traceId: trace.traceId },
  });

  const isTradingDay = await deps.tradingDayService.isTradingDay(now);

  if (!isTradingDay) {
    logger.info('runSettlementJob', 'Not a trading day, skipping settlement');
    return Object.freeze({
      marketsSettled: 0,
      adminSettleScheduled: 0,
      failures: [],
      skipped: true,
      durationMs: traceElapsed(trace),
    });
  }

  // Resolve markets: use injected list (tests) or query on-chain (production)
  const resolvedMarkets = activeMarkets ?? await deps.meridianClient.getActiveMarkets();

  const failures: string[] = [];
  let marketsSettled = 0;
  let adminSettleScheduled = 0;

  for (const market of resolvedMarkets) {
    try {
      const result = await settleMarket(market, deps);
      if (result.settled) {
        marketsSettled += 1;
      }
      if (result.adminScheduled) {
        adminSettleScheduled += 1;
      }
      if (result.error) {
        failures.push(`${market.ticker}@${market.strikePrice}: ${result.error}`);
      }
    } catch (err) {
      const msg = `${market.ticker}@${market.strikePrice}: ${err instanceof Error ? err.message : String(err)}`;
      failures.push(msg);
      logger.error('runSettlementJob', `Failed to settle market`, {
        error: err,
        context: { ticker: market.ticker, strikePrice: market.strikePrice },
      });
    }
  }

  const summary: SettlementJobSummary = Object.freeze({
    marketsSettled,
    adminSettleScheduled,
    failures,
    skipped: false,
    durationMs: traceElapsed(trace),
  });

  logger.info('runSettlementJob', 'Settlement job completed', {
    context: {
      ...summary,
      traceId: trace.traceId,
    },
    duration_ms: summary.durationMs,
  });

  return summary;
}
