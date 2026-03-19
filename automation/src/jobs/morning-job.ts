/**
 * @module morning-job
 * Morning job orchestration: fetches previous close prices,
 * calculates strikes, and creates on-chain strike markets.
 */

import type { PriceServiceAdapter, TradingDayAdapter } from '@meridian/shared/adapters/types.js';
import type { MeridianClient } from '../services/meridian-client.js';
import type { AlertService } from '../services/alert-service.js';
import type { PhoenixMarketFactory } from '../services/phoenix-market-factory.js';
import { MERIDIAN_CONFIG, PYTH_FEED_IDS, type SupportedTicker } from '@meridian/shared/constants.js';
import { PublicKey } from '@solana/web3.js';
import { Logger } from '@meridian/shared/logger.js';
import { debugLog } from '@meridian/shared/debug.js';
import { startTrace, traceElapsed } from '@meridian/shared/tracing.js';
import { calculateStrikes } from '../services/strike-calculator.js';
import { withRetry } from '../utils/retry.js';

const logger = new Logger('morning-job');

/** Dependencies injected into the morning job. */
export interface MorningJobDeps {
  readonly priceService: PriceServiceAdapter;
  readonly tradingDayService: TradingDayAdapter;
  readonly meridianClient: MeridianClient;
  readonly alertService: AlertService;
  /** Optional Phoenix market factory. When provided, creates real Phoenix
   *  order books for each strike market atomically via a single transaction. */
  readonly phoenixMarketFactory?: PhoenixMarketFactory;
  /** USDC mint address (needed for Phoenix market creation). */
  readonly usdcMintAddress?: string;
}

/** Summary of the morning job execution. */
export interface MorningJobSummary {
  readonly tickersProcessed: number;
  readonly strikesCreated: number;
  readonly failures: readonly string[];
  readonly skipped: boolean;
  readonly durationMs: number;
}

/**
 * Get the Unix timestamp for yesterday's market close (4 PM ET).
 */
function getYesterdayCloseTimestamp(now: Date): number {
  const yesterday = new Date(now.getTime() - 86_400_000);
  // Create 4 PM ET timestamp
  const year = yesterday.getFullYear();
  const month = yesterday.getMonth();
  const day = yesterday.getDate();
  // Approximate ET as UTC-5 (not accounting for DST perfectly, but close)
  const closeUTC = new Date(Date.UTC(year, month, day, 21, 0, 0)); // 4 PM ET = 9 PM UTC
  return Math.floor(closeUTC.getTime() / 1000);
}

/**
 * Process a single ticker: fetch price, calculate strikes, create markets.
 *
 * When a Phoenix factory + USDC mint are provided, creates the strike market,
 * Phoenix order book, and link in a single atomic Solana transaction:
 *   Ix 1: createStrikeMarket (creates YES/NO mints, placeholder phoenix address)
 *   Ix 2+: Phoenix InitializeMarket (uses the YES mint just created in Ix 1)
 *   Ix N: setPhoenixMarket (stores the real Phoenix address on the strike market)
 *
 * Without Phoenix factory, falls back to a single createStrikeMarket call.
 */
async function processTicker(
  ticker: SupportedTicker,
  deps: MorningJobDeps,
  closeTimestamp: number,
  tradingDate: number,
): Promise<{ strikesCreated: number; error?: string }> {
  const feedId = PYTH_FEED_IDS[ticker];

  const priceData = await withRetry(
    () => deps.priceService.getHistoricalPrice(feedId, closeTimestamp),
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 5000,
      operationName: `getHistoricalPrice(${ticker})`,
    },
  );

  logger.info('processTicker', `${ticker} previous close: $${priceData.price.toFixed(2)}`, {
    context: { ticker, price: priceData.price, confidence: priceData.confidence },
  });

  const strikes = calculateStrikes(priceData.price);

  logger.info('processTicker', `${ticker}: ${strikes.length} strikes calculated`, {
    context: { ticker, strikes },
  });

  const useAtomicPhoenix = !!(deps.phoenixMarketFactory && deps.usdcMintAddress);

  let created = 0;
  for (const strike of strikes) {
    debugLog('CRON_JOBS', 'morning-job', 'processTicker', `Creating market: ${ticker} @ $${strike}`, {
      ticker,
      strike,
      tradingDate,
    });

    if (useAtomicPhoenix) {
      // Atomic path: build all instructions, send as one transaction.
      const { instruction: createIx, strikeMarketAddress, yesMintAddress } =
        await deps.meridianClient.buildCreateStrikeMarketIx({
          ticker,
          strikePrice: strike,
          tradingDate,
        });

      const { instructions: phoenixIxs, marketKeypair, phoenixMarketAddress } =
        await deps.phoenixMarketFactory!.buildCreateMarketIxs(yesMintAddress, deps.usdcMintAddress!);

      const setIx = await deps.meridianClient.buildSetPhoenixMarketIx({
        marketAddress: strikeMarketAddress,
        phoenixMarketAddress,
      });

      await withRetry(
        () => deps.meridianClient.sendInstructions(
          [createIx, ...phoenixIxs, setIx],
          [marketKeypair],
        ),
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          maxDelayMs: 10000,
          operationName: `atomicCreateMarket(${ticker}@$${strike})`,
        },
      );

      logger.info('processTicker', `Market + Phoenix created atomically: ${ticker} @ $${strike}`, {
        context: { ticker, strike, strikeMarket: strikeMarketAddress, phoenixMarket: phoenixMarketAddress },
      });
    } else {
      // Fallback: create strike market with placeholder phoenix address.
      const phoenixPlaceholder = PublicKey.default.toBase58();

      await withRetry(
        () => deps.meridianClient.createStrikeMarket({
          ticker,
          strikePrice: strike,
          tradingDate,
          phoenixMarketAddress: phoenixPlaceholder,
        }),
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          maxDelayMs: 10000,
          operationName: `createStrikeMarket(${ticker}@$${strike})`,
        },
      );

      logger.info('processTicker', `Market created: ${ticker} @ $${strike}`, {
        context: { ticker, strike },
      });
    }

    created += 1;
  }

  return { strikesCreated: created };
}

/**
 * Execute the morning job: check trading day, process all tickers.
 */
export async function runMorningJob(
  deps: MorningJobDeps,
  now: Date = new Date(),
): Promise<MorningJobSummary> {
  const trace = startTrace('morning-job');
  logger.info('runMorningJob', 'Morning job started', { context: { traceId: trace.traceId } });

  const isTradingDay = await deps.tradingDayService.isTradingDay(now);

  if (!isTradingDay) {
    logger.info('runMorningJob', 'Not a trading day, skipping morning job');
    return Object.freeze({
      tickersProcessed: 0,
      strikesCreated: 0,
      failures: [],
      skipped: true,
      durationMs: traceElapsed(trace),
    });
  }

  const closeTimestamp = getYesterdayCloseTimestamp(now);
  // Use today's 4 PM ET (market close) as the trading date.
  // This must be in the future when the morning job runs (typically 8 AM ET)
  // to satisfy the on-chain require(trading_date >= clock.unix_timestamp).
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  // 4 PM ET = 21:00 UTC (EST). During EDT it's 20:00 UTC, but close enough.
  const todayCloseUTC = new Date(Date.UTC(year, month, day, 21, 0, 0));
  const tradingDate = Math.floor(todayCloseUTC.getTime() / 1000);
  const tickers = MERIDIAN_CONFIG.SUPPORTED_TICKERS;
  const failures: string[] = [];
  let totalStrikes = 0;
  let tickersProcessed = 0;

  for (const ticker of tickers) {
    try {
      const result = await processTicker(ticker, deps, closeTimestamp, tradingDate);
      totalStrikes += result.strikesCreated;
      tickersProcessed += 1;
    } catch (err) {
      const msg = `${ticker}: ${err instanceof Error ? err.message : String(err)}`;
      failures.push(msg);
      logger.error('runMorningJob', `Failed to process ${ticker}`, { error: err });
    }
  }

  if (failures.length > 0) {
    await deps.alertService.sendAlert(
      failures.length === tickers.length ? 'critical' : 'warning',
      'Morning Job Failures',
      {
        failedTickers: failures,
        tickersProcessed,
        strikesCreated: totalStrikes,
        totalTickers: tickers.length,
      },
    );
  }

  const summary: MorningJobSummary = Object.freeze({
    tickersProcessed,
    strikesCreated: totalStrikes,
    failures,
    skipped: false,
    durationMs: traceElapsed(trace),
  });

  logger.info('runMorningJob', 'Morning job completed', {
    context: {
      ...summary,
      traceId: trace.traceId,
    },
    duration_ms: summary.durationMs,
  });

  return summary;
}
