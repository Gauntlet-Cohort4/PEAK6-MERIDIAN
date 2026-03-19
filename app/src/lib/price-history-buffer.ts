/**
 * @module price-history-buffer
 * Module-level buffer that accumulates live Pyth prices into a time series.
 * Each ticker maintains a rolling window of PricePoint entries.
 *
 * This is the single source of truth for price history data in the app.
 * usePythPrice pushes new prices here; usePriceHistory reads from here.
 */

/** A single price data point for charting. */
export interface PricePoint {
  readonly time: number;
  readonly value: number;
}

/** Maximum number of data points to keep per ticker. */
const MAX_BUFFER_SIZE = 200;

/** Minimum interval between recorded points (ms) to avoid duplicates. */
const MIN_INTERVAL_MS = 5_000;

/** Number of synthetic seed points to generate when seeding a new ticker. */
const SEED_POINT_COUNT = 78;

/** Interval between seed points (ms) — 5 minutes. */
const SEED_INTERVAL_MS = 5 * 60 * 1000;

/** Small volatility factor for seed data so the chart isn't a flat line. */
const SEED_VOLATILITY = 0.0005;

/**
 * Module-level price history storage.
 * Key: ticker symbol, Value: array of price points sorted by time ascending.
 */
const historyBuffers = new Map<string, PricePoint[]>();

/** Tracks the last recorded timestamp per ticker to enforce MIN_INTERVAL_MS. */
const lastRecordedTime = new Map<string, number>();

/** Listeners that get notified when a ticker's history changes. */
type HistoryListener = () => void;
const listeners = new Map<string, Set<HistoryListener>>();

/**
 * Generate seed data points so charts aren't empty on first load.
 * Creates points going back in time from `now`, with tiny random walk
 * variation around the base price.
 */
function generateSeedPoints(basePrice: number, now: number): readonly PricePoint[] {
  const points: PricePoint[] = [];
  let price = basePrice;

  for (let i = SEED_POINT_COUNT - 1; i >= 0; i--) {
    const time = now - i * SEED_INTERVAL_MS;
    const drift = (Math.random() - 0.5) * basePrice * SEED_VOLATILITY * 2;
    price = price + drift;
    // Clamp to avoid unrealistic deviation from base
    const maxDev = basePrice * 0.01;
    price = Math.max(basePrice - maxDev, Math.min(basePrice + maxDev, price));

    points.push({
      time,
      value: parseFloat(price.toFixed(2)),
    });
  }

  return points;
}

/**
 * Record a new price for a ticker. Called by usePythPrice on each poll.
 * If the ticker has no history yet, seeds it with synthetic data first.
 */
export function recordPrice(ticker: string, price: number, timestamp: number): void {
  const lastTime = lastRecordedTime.get(ticker) ?? 0;

  // Enforce minimum interval to avoid flooding the buffer
  if (timestamp - lastTime < MIN_INTERVAL_MS) {
    return;
  }

  let buffer = historyBuffers.get(ticker);

  // First price for this ticker — seed with synthetic history
  if (!buffer) {
    const seedPoints = generateSeedPoints(price, timestamp);
    buffer = [...seedPoints];
    historyBuffers.set(ticker, buffer);
  }

  // Append the new real price
  buffer.push({
    time: timestamp,
    value: parseFloat(price.toFixed(2)),
  });

  // Trim to max size (remove oldest)
  while (buffer.length > MAX_BUFFER_SIZE) {
    buffer.shift();
  }

  lastRecordedTime.set(ticker, timestamp);

  // Notify listeners
  const tickerListeners = listeners.get(ticker);
  if (tickerListeners) {
    for (const listener of tickerListeners) {
      listener();
    }
  }
}

/**
 * Get the current price history for a ticker.
 * Returns a frozen copy to preserve immutability.
 */
export function getHistory(ticker: string): readonly PricePoint[] {
  const buffer = historyBuffers.get(ticker);
  return buffer ? [...buffer] : [];
}

/**
 * Subscribe to history changes for a ticker.
 * Returns an unsubscribe function.
 */
export function subscribe(ticker: string, listener: HistoryListener): () => void {
  let tickerListeners = listeners.get(ticker);
  if (!tickerListeners) {
    tickerListeners = new Set();
    listeners.set(ticker, tickerListeners);
  }
  tickerListeners.add(listener);

  return () => {
    tickerListeners.delete(listener);
    if (tickerListeners.size === 0) {
      listeners.delete(ticker);
    }
  };
}
