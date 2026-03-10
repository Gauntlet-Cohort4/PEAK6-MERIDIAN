/**
 * @module scripts/demo
 * Full lifecycle demo script for the Meridian prediction market.
 *
 * Exercises the complete flow:
 * 1. Initialize config with admin
 * 2. Register tickers
 * 3. Create strike markets
 * 4. Mint pairs
 * 5. Place orders on Phoenix
 * 6. Settle markets
 * 7. Redeem tokens
 *
 * Uses devnet by default, can be configured for localnet (Surfpool).
 *
 * Usage:
 *   npx ts-node scripts/demo.ts
 *   SOLANA_CLUSTER=localnet npx ts-node scripts/demo.ts
 */

import { MERIDIAN_CONFIG } from '../shared/constants';

/** Demo configuration from environment. */
interface DemoConfig {
  readonly cluster: 'devnet' | 'localnet';
  readonly rpcUrl: string;
  readonly adminKeypairPath: string;
}

function loadDemoConfig(): DemoConfig {
  const cluster = (process.env['SOLANA_CLUSTER'] ?? 'devnet') as 'devnet' | 'localnet';
  const rpcUrl = cluster === 'localnet'
    ? 'http://localhost:8899'
    : (process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com');
  const adminKeypairPath = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';

  return Object.freeze({ cluster, rpcUrl, adminKeypairPath });
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

// --- Step functions (stubs) ---

async function initializeConfig(config: DemoConfig): Promise<string> {
  log('1-init', 'Initializing Meridian config PDA', {
    cluster: config.cluster,
    rpcUrl: config.rpcUrl,
  });

  // TODO: Build and send initialize_config instruction
  // const program = new Program(MeridianIDL, programId, provider);
  // const tx = await program.methods.initializeConfig().accounts({...}).rpc();
  const mockTx = `demo-init-${Date.now()}`;
  log('1-init', 'Config initialized', { signature: mockTx });
  return mockTx;
}

async function registerTickers(config: DemoConfig): Promise<readonly string[]> {
  const signatures: string[] = [];

  for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
    log('2-register', `Registering ticker: ${ticker}`, { ticker });

    // TODO: Build and send register_ticker instruction
    const mockTx = `demo-register-${ticker}-${Date.now()}`;
    signatures.push(mockTx);

    log('2-register', `Ticker registered: ${ticker}`, { signature: mockTx });
  }

  return Object.freeze(signatures);
}

async function createStrikeMarkets(
  config: DemoConfig,
): Promise<readonly { ticker: string; strike: number; address: string }[]> {
  const markets: { ticker: string; strike: number; address: string }[] = [];

  // Demo with just AAPL and NVDA for brevity
  const demoTickers = ['AAPL', 'NVDA'] as const;
  const demoPrice = { AAPL: 185, NVDA: 880 } as const;

  for (const ticker of demoTickers) {
    const basePrice = demoPrice[ticker];
    const strikes = MERIDIAN_CONFIG.STRIKE_OFFSETS_PERCENT.map((offset) => {
      const raw = basePrice * (1 + offset / 100);
      return Math.round(raw / MERIDIAN_CONFIG.STRIKE_ROUNDING) * MERIDIAN_CONFIG.STRIKE_ROUNDING;
    });

    for (const strike of strikes) {
      log('3-create', `Creating market: ${ticker} @ $${strike}`, { ticker, strike });

      // TODO: Create Phoenix market, then Meridian strike market
      const mockAddress = `market-${ticker}-${strike}-${Date.now()}`;
      markets.push({ ticker, strike, address: mockAddress });

      log('3-create', `Market created: ${ticker} @ $${strike}`, { address: mockAddress });
    }
  }

  return Object.freeze(markets);
}

async function mintPairs(
  markets: readonly { ticker: string; strike: number; address: string }[],
): Promise<void> {
  for (const market of markets) {
    const amount = 10;
    log('4-mint', `Minting ${amount} pairs for ${market.ticker} @ $${market.strike}`, {
      marketAddress: market.address,
      amount,
      usdcCost: amount * MERIDIAN_CONFIG.PAIR_COST_USDC,
    });

    // TODO: Build and send mint_pair transaction
    log('4-mint', `Minted ${amount} pairs`, { market: market.address });
  }
}

async function placeOrders(
  markets: readonly { ticker: string; strike: number; address: string }[],
): Promise<void> {
  for (const market of markets) {
    log('5-order', `Placing orders on Phoenix for ${market.ticker} @ $${market.strike}`, {
      marketAddress: market.address,
    });

    // TODO: Place bid and ask orders on Phoenix
    log('5-order', 'Placed bid @ 0.45 and ask @ 0.55', { market: market.address });
  }
}

async function settleMarkets(
  markets: readonly { ticker: string; strike: number; address: string }[],
): Promise<void> {
  for (const market of markets) {
    log('6-settle', `Settling market: ${market.ticker} @ $${market.strike}`, {
      marketAddress: market.address,
    });

    // TODO: Build and send settle_market instruction
    log('6-settle', 'Market settled', {
      market: market.address,
      outcome: 'YES', // stub
    });
  }
}

async function redeemTokens(
  markets: readonly { ticker: string; strike: number; address: string }[],
): Promise<void> {
  for (const market of markets) {
    log('7-redeem', `Redeeming YES tokens for ${market.ticker} @ $${market.strike}`, {
      marketAddress: market.address,
      tokenType: 'yes',
    });

    // TODO: Build and send redeem instruction
    log('7-redeem', 'Tokens redeemed', { market: market.address });
  }
}

// --- Main ---

async function main(): Promise<void> {
  log('start', '=== Meridian Full Lifecycle Demo ===');

  const config = loadDemoConfig();
  log('start', `Using cluster: ${config.cluster}`, { rpcUrl: config.rpcUrl });

  await initializeConfig(config);
  await registerTickers(config);
  const markets = await createStrikeMarkets(config);
  await mintPairs(markets);
  await placeOrders(markets);
  await settleMarkets(markets);
  await redeemTokens(markets);

  log('done', '=== Demo complete ===', {
    marketsCreated: markets.length,
    tickers: [...new Set(markets.map((m) => m.ticker))],
  });
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
