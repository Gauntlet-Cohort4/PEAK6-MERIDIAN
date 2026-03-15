/**
 * @module morning-job
 * Morning job orchestration: fetches previous close prices,
 * calculates strikes, and creates on-chain strike markets.
 */

import type { PriceServiceAdapter, TradingDayAdapter } from '@meridian/shared/adapters/types.js';
import type { MeridianClient } from '../services/meridian-client.js';
import { MERIDIAN_CONFIG, PYTH_FEED_IDS, type SupportedTicker } from '@meridian/shared/constants.js';
import { PublicKey } from '@solana/web3.js';
import { Logger } from '@meridian/shared/logger.js';
import { debugLog } from '@meridian/shared/debug.js';
import { startTrace, traceElapsed } from '@meridian/shared/tracing.js';
import { calculateStrikes } from '../services/strike-calculator.js';

const logger = new Logger('morning-job');

/** Dependencies injected into the morning job. */
export interface MorningJobDeps {
  readonly priceService: PriceServiceAdapter;
  readonly tradingDayService: TradingDayAdapter;
  readonly meridianClient: MeridianClient;
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
 */
async function processTicker(
  ticker: SupportedTicker,
  deps: MorningJobDeps,
  closeTimestamp: number,
  tradingDate: number,
): Promise<{ strikesCreated: number; error?: string }> {
  const feedId = PYTH_FEED_IDS[ticker];

  const priceData = await deps.priceService.getHistoricalPrice(feedId, closeTimestamp);

  logger.info('processTicker', `${ticker} previous close: $${priceData.price.toFixed(2)}`, {
    context: { ticker, price: priceData.price, confidence: priceData.confidence },
  });

  const strikes = calculateStrikes(priceData.price);

  logger.info('processTicker', `${ticker}: ${strikes.length} strikes calculated`, {
    context: { ticker, strikes },
  });

  let created = 0;
  for (const strike of strikes) {
    debugLog('CRON_JOBS', 'morning-job', 'processTicker', `Creating market: ${ticker} @ $${strike}`, {
      ticker,
      strike,
      tradingDate,
    });

    // TODO: Replace with a real Phoenix DEX market address in production.
    // Using SystemProgram address (11111...1) as a devnet placeholder since
    // Phoenix DEX isn't live yet.
    const phoenixMarketAddress = PublicKey.default.toBase58();

    const signature = await deps.meridianClient.createStrikeMarket({
      ticker,
      strikePrice: strike,
      tradingDate,
      phoenixMarketAddress,
    });

    logger.info('processTicker', `Market created: ${ticker} @ $${strike}`, {
      context: { ticker, strike, signature },
    });

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
  const tradingDate = Math.floor(now.getTime() / 1000);
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
