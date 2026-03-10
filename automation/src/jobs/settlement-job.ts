/**
 * @module settlement-job
 * Settlement job orchestration: settles markets using oracle prices.
 * On-chain calls are stubbed for Stage A.
 */

import type { PriceServiceAdapter, TradingDayAdapter } from '@meridian/shared/adapters/types.js';
import type { MeridianClient } from '../services/meridian-client.js';
import { MERIDIAN_CONFIG, type SupportedTicker } from '@meridian/shared/constants.js';
import { Logger } from '@meridian/shared/logger.js';
import { debugLog } from '@meridian/shared/debug.js';
import { startTrace, traceElapsed } from '@meridian/shared/tracing.js';

const logger = new Logger('settlement-job');

/** Pyth feed IDs for supported tickers (same as morning job). */
const TICKER_FEED_IDS: Readonly<Record<SupportedTicker, string>> = {
  AAPL: 'b3a83305180090ac564afcc05ad973e5d1b7e0d1e9a8cc2b495a1cf0a4026752',
  MSFT: 'c2e03ef975e12b5e0de3cc609e3e5f7e1cf4a35d327f89b97e7d174ab0d1c7c8',
  GOOGL: 'e13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  AMZN: 'a13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  NVDA: 'b13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  META: 'c13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
  TSLA: 'd13b1c3f0e66c3f23e6e0f0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f0e0f',
};

/** Dependencies injected into the settlement job. */
export interface SettlementJobDeps {
  readonly priceService: PriceServiceAdapter;
  readonly tradingDayService: TradingDayAdapter;
  readonly meridianClient: MeridianClient;
}

/** Summary of the settlement job execution. */
export interface SettlementJobSummary {
  readonly marketsSettled: number;
  readonly adminSettleScheduled: number;
  readonly failures: readonly string[];
  readonly skipped: boolean;
  readonly durationMs: number;
}

/** Represents an active market to settle. */
export interface ActiveMarket {
  readonly ticker: SupportedTicker;
  readonly strikePrice: number;
  readonly marketAddress: string;
}

/**
 * Settle a single market using the oracle price.
 * Falls back to scheduling admin settlement if oracle is unavailable.
 */
async function settleMarket(
  market: ActiveMarket,
  deps: SettlementJobDeps,
): Promise<{ settled: boolean; adminScheduled: boolean; error?: string }> {
  const feedId = TICKER_FEED_IDS[market.ticker];

  try {
    const priceData = await deps.priceService.getLatestPrice(feedId);

    debugLog('CRON_JOBS', 'settlement-job', 'settleMarket', 'Oracle price fetched', {
      ticker: market.ticker,
      price: priceData.price,
      strikePrice: market.strikePrice,
    });

    const signature = await deps.meridianClient.settleMarket({
      marketAddress: market.marketAddress,
      pythPriceAccount: feedId,
    });

    logger.info('settleMarket', `Settled ${market.ticker} @ $${market.strikePrice}`, {
      context: {
        ticker: market.ticker,
        strikePrice: market.strikePrice,
        settlementPrice: priceData.price,
        marketAddress: market.marketAddress,
        outcome: priceData.price >= market.strikePrice ? 'YES' : 'NO',
        signature,
      },
    });

    return { settled: true, adminScheduled: false };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn('settleMarket', `Oracle failed for ${market.ticker}, scheduling admin settle`, {
      error: err,
      context: {
        ticker: market.ticker,
        delaySeconds: MERIDIAN_CONFIG.ADMIN_SETTLE_DELAY_SECONDS,
      },
    });

    // Schedule admin_settle as fallback after delay
    const yesWins = true; // TODO: Determine outcome from backup data source
    debugLog('CRON_JOBS', 'settlement-job', 'settleMarket', 'Scheduling admin settle', {
      ticker: market.ticker,
      marketAddress: market.marketAddress,
      delaySeconds: MERIDIAN_CONFIG.ADMIN_SETTLE_DELAY_SECONDS,
    });

    try {
      await deps.meridianClient.adminSettle({
        marketAddress: market.marketAddress,
        outcomeYesWins: yesWins,
      });
    } catch (adminErr) {
      logger.error('settleMarket', `Admin settle also failed for ${market.ticker}`, {
        error: adminErr,
      });
    }

    return { settled: false, adminScheduled: true, error: errorMsg };
  }
}

/**
 * Get active markets to settle.
 * STUBBED: returns mock data. Stage B will query on-chain state.
 */
export function getActiveMarkets(): readonly ActiveMarket[] {
  // STUB: In production, query on-chain for markets with status CLOSED
  logger.info('getActiveMarkets', '[STUB] Would query on-chain for active markets');
  return Object.freeze([]);
}

/**
 * Execute the settlement job: check trading day, settle all active markets.
 */
export async function runSettlementJob(
  deps: SettlementJobDeps,
  activeMarkets: readonly ActiveMarket[] = getActiveMarkets(),
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

  const failures: string[] = [];
  let marketsSettled = 0;
  let adminSettleScheduled = 0;

  for (const market of activeMarkets) {
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
