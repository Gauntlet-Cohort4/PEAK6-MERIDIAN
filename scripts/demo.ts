/**
 * @module scripts/demo
 * Full lifecycle demo script for the Meridian prediction market.
 *
 * Exercises the complete flow using real Anchor instructions:
 * 1. Initialize config with admin
 * 2. Register tickers (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA)
 * 3. Create strike markets for today
 * 4. Mint YES+NO token pairs
 * 5. Place an order on Phoenix (simulated -- requires live Phoenix market)
 * 6. Settle market via admin_settle
 * 7. Redeem winning tokens
 *
 * Uses devnet by default, can be configured for localnet (Surfpool).
 *
 * Usage:
 *   npx ts-node scripts/demo.ts
 *   SOLANA_CLUSTER=localnet npx ts-node scripts/demo.ts
 */

import {
  BN,
  Connection,
  Keypair,
  PublicKey,
  Wallet,
  LAMPORTS_PER_SOL,
  log,
  loadKeypair,
  createProvider,
  createProgram,
  deriveConfigPda,
  deriveTickerPda,
  deriveStrikeMarketPda,
  deriveYesMintPda,
  deriveNoMintPda,
  deriveVaultPda,
  todayTradingDate,
  sleep,
  PYTH_FEED_IDS,
  DEVNET_USDC_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  RENT_SYSVAR,
  PROGRAM_ID,
  SystemProgram,
  getAssociatedTokenAddress,
} from './helpers';
import type { SupportedTicker } from './helpers';

/** Platform configuration mirrored from shared/constants. */
const MERIDIAN_CONFIG = {
  SUPPORTED_TICKERS: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] as const,
  STRIKE_OFFSETS_PERCENT: [3, 6, 9] as const,
  STRIKE_ROUNDING: 10,
  PAIR_COST_USDC: 1_000_000,
  USDC_DECIMALS: 6,
  INTER_TX_DELAY_MS: 500,
} as const;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface DemoConfig {
  readonly cluster: 'devnet' | 'localnet';
  readonly rpcUrl: string;
  readonly adminKeypairPath: string;
}

function loadDemoConfig(): DemoConfig {
  const cluster = (process.env['SOLANA_CLUSTER'] ?? 'devnet') as 'devnet' | 'localnet';
  const rpcUrl =
    cluster === 'localnet'
      ? 'http://localhost:8899'
      : (process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com');
  const adminKeypairPath = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';

  return Object.freeze({ cluster, rpcUrl, adminKeypairPath });
}

// ---------------------------------------------------------------------------
// Market info returned from step 3
// ---------------------------------------------------------------------------

interface MarketInfo {
  readonly ticker: string;
  readonly strikePriceCents: number;
  readonly strikePriceBn: BN;
  readonly tradingDate: BN;
  readonly strikeMarketPda: PublicKey;
  readonly yesMintPda: PublicKey;
  readonly noMintPda: PublicKey;
  readonly vaultPda: PublicKey;
  readonly tickerPda: PublicKey;
}

// ---------------------------------------------------------------------------
// Step 1: Initialize Config
// ---------------------------------------------------------------------------

async function initializeConfig(program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, admin: Keypair): Promise<string> {
  log('1-init', 'Initializing Meridian config PDA');

  const [configPda] = deriveConfigPda();

  // Check if already initialized
  try {
    const existing = await program.account['meridianConfig'].fetch(configPda);
    if (existing) {
      log('1-init', 'Config already initialized, skipping', {
        configPda: configPda.toBase58(),
      });
      return 'already-initialized';
    }
  } catch {
    // Account does not exist yet -- proceed with init
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

  log('1-init', 'Config initialized', { signature: tx, configPda: configPda.toBase58() });
  return tx;
}

// ---------------------------------------------------------------------------
// Step 2: Register Tickers
// ---------------------------------------------------------------------------

async function registerTickers(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  admin: Keypair,
): Promise<readonly string[]> {
  const signatures: string[] = [];
  const [configPda] = deriveConfigPda();

  for (const ticker of MERIDIAN_CONFIG.SUPPORTED_TICKERS) {
    log('2-register', `Registering ticker: ${ticker}`);

    const [tickerPda] = deriveTickerPda(ticker);
    const feedIdHex = PYTH_FEED_IDS[ticker];
    const feedIdPubkey = new PublicKey(Buffer.from(feedIdHex, 'hex'));

    // Check if already registered
    try {
      const existing = await program.account['tickerConfig'].fetch(tickerPda);
      if (existing) {
        log('2-register', `Ticker already registered: ${ticker}`, {
          tickerPda: tickerPda.toBase58(),
        });
        signatures.push('already-registered');
        continue;
      }
    } catch {
      // Not found, register it
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

    signatures.push(tx);
    log('2-register', `Ticker registered: ${ticker}`, {
      signature: tx,
      tickerPda: tickerPda.toBase58(),
    });

    await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
  }

  return Object.freeze(signatures);
}

// ---------------------------------------------------------------------------
// Step 3: Create Strike Markets
// ---------------------------------------------------------------------------

async function createStrikeMarkets(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  admin: Keypair,
): Promise<readonly MarketInfo[]> {
  const markets: MarketInfo[] = [];
  const [configPda] = deriveConfigPda();
  const tradingDate = todayTradingDate();

  // Demo with AAPL and NVDA for brevity
  const demoTickers: readonly SupportedTicker[] = ['AAPL', 'NVDA'];
  const demoSpotPriceCents: Readonly<Record<string, number>> = {
    AAPL: 18500,  // $185.00
    NVDA: 88000,  // $880.00
  };

  // Phoenix market placeholder -- in production this would be a real Phoenix market
  // For the demo we use a dummy keypair as the phoenix_market address
  const phoenixMarketDummy = Keypair.generate();

  for (const ticker of demoTickers) {
    const [tickerPda] = deriveTickerPda(ticker);
    const basePrice = demoSpotPriceCents[ticker] ?? 0;

    const strikePricesCents = MERIDIAN_CONFIG.STRIKE_OFFSETS_PERCENT.map((offset) => {
      const raw = basePrice * (1 + offset / 100);
      // Round to nearest $10 = 1000 cents
      return Math.round(raw / (MERIDIAN_CONFIG.STRIKE_ROUNDING * 100)) *
        (MERIDIAN_CONFIG.STRIKE_ROUNDING * 100);
    });

    for (const strikeCents of strikePricesCents) {
      const strikePriceBn = new BN(strikeCents);
      const [strikeMarketPda] = deriveStrikeMarketPda(ticker, strikePriceBn, tradingDate);
      const [yesMintPda] = deriveYesMintPda(strikeMarketPda);
      const [noMintPda] = deriveNoMintPda(strikeMarketPda);
      const [vaultPda] = deriveVaultPda(strikeMarketPda);

      log('3-create', `Creating market: ${ticker} @ ${strikeCents} cents`, {
        ticker,
        strikeCents,
        tradingDate: tradingDate.toString(),
      });

      // Check if already exists
      try {
        const existing = await program.account['strikeMarket'].fetch(strikeMarketPda);
        if (existing) {
          log('3-create', `Market already exists: ${ticker} @ ${strikeCents}`, {
            strikeMarketPda: strikeMarketPda.toBase58(),
          });
          markets.push({
            ticker,
            strikePriceCents: strikeCents,
            strikePriceBn,
            tradingDate,
            strikeMarketPda,
            yesMintPda,
            noMintPda,
            vaultPda,
            tickerPda,
          });
          continue;
        }
      } catch {
        // Does not exist yet
      }

      const tx = await program.methods
        .createStrikeMarket(strikePriceBn, tradingDate)
        .accountsStrict({
          admin: admin.publicKey,
          config: configPda,
          tickerConfig: tickerPda,
          strikeMarket: strikeMarketPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          usdcMint: DEVNET_USDC_MINT,
          vault: vaultPda,
          phoenixMarket: phoenixMarketDummy.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: RENT_SYSVAR,
        })
        .signers([admin])
        .rpc();

      log('3-create', `Market created: ${ticker} @ ${strikeCents} cents`, {
        signature: tx,
        strikeMarketPda: strikeMarketPda.toBase58(),
      });

      markets.push({
        ticker,
        strikePriceCents: strikeCents,
        strikePriceBn,
        tradingDate,
        strikeMarketPda,
        yesMintPda,
        noMintPda,
        vaultPda,
        tickerPda,
      });

      await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
    }
  }

  return Object.freeze(markets);
}

// ---------------------------------------------------------------------------
// Step 4: Mint YES+NO Pairs
// ---------------------------------------------------------------------------

async function mintPairs(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  user: Keypair,
  markets: readonly MarketInfo[],
): Promise<void> {
  for (const market of markets) {
    const amount = new BN(10 * MERIDIAN_CONFIG.PAIR_COST_USDC); // 10 pairs

    // Derive user token accounts
    const userUsdc = await getAssociatedTokenAddress(
      DEVNET_USDC_MINT,
      user.publicKey,
    );
    const userYes = await getAssociatedTokenAddress(
      market.yesMintPda,
      user.publicKey,
    );
    const userNo = await getAssociatedTokenAddress(
      market.noMintPda,
      user.publicKey,
    );

    log('4-mint', `Minting 10 pairs for ${market.ticker} @ ${market.strikePriceCents} cents`, {
      strikeMarket: market.strikeMarketPda.toBase58(),
      amount: amount.toString(),
    });

    const tx = await program.methods
      .mintPair(amount)
      .accountsStrict({
        user: user.publicKey,
        config: deriveConfigPda()[0],
        strikeMarket: market.strikeMarketPda,
        yesMint: market.yesMintPda,
        noMint: market.noMintPda,
        userUsdc,
        userYes,
        userNo,
        usdcMint: DEVNET_USDC_MINT,
        vault: market.vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    log('4-mint', `Minted 10 pairs`, {
      signature: tx,
      market: market.strikeMarketPda.toBase58(),
    });

    await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
  }
}

// ---------------------------------------------------------------------------
// Step 5: Place Orders (simulated -- requires live Phoenix market)
// ---------------------------------------------------------------------------

async function placeOrders(
  markets: readonly MarketInfo[],
): Promise<void> {
  for (const market of markets) {
    log('5-order', `Simulating order placement for ${market.ticker} @ ${market.strikePriceCents}`, {
      strikeMarket: market.strikeMarketPda.toBase58(),
      note: 'Phoenix CPI requires a live Phoenix market. Skipping in demo mode.',
    });

    // In production, you would call buy_no_limit / buy_no_market / sell_no
    // passing all Phoenix accounts (phoenix_program, phoenix_market,
    // phoenix_base_vault, phoenix_quote_vault, pda_yes_account, pda_quote_account).
    //
    // Example (pseudo):
    //   await program.methods
    //     .buyNoLimit(new BN(amount), new BN(priceInTicks))
    //     .accountsStrict({ user, config, strikeMarket, yesMint, noMint,
    //       userUsdc, userNo, pdaYesAccount, pdaQuoteAccount, vault,
    //       phoenixProgram, phoenixMarket, phoenixBaseVault, phoenixQuoteVault,
    //       tokenProgram })
    //     .signers([user])
    //     .rpc();

    log('5-order', 'Order placement simulated (bid @ 0.45, ask @ 0.55)', {
      market: market.strikeMarketPda.toBase58(),
    });
  }
}

// ---------------------------------------------------------------------------
// Step 6: Settle Markets (admin settle)
// ---------------------------------------------------------------------------

async function settleMarkets(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  admin: Keypair,
  markets: readonly MarketInfo[],
): Promise<void> {
  const [configPda] = deriveConfigPda();

  for (const market of markets) {
    // Simulate settlement price: spot + 2% (YES wins for above-strike markets)
    const settlementPriceCents = market.strikePriceCents + 100; // $1 above strike
    const outcomeYesWins = true;

    log('6-settle', `Settling market: ${market.ticker} @ ${market.strikePriceCents} cents`, {
      settlementPriceCents,
      outcomeYesWins,
    });

    const tx = await program.methods
      .adminSettle(outcomeYesWins, new BN(settlementPriceCents))
      .accountsStrict({
        admin: admin.publicKey,
        config: configPda,
        strikeMarket: market.strikeMarketPda,
      })
      .signers([admin])
      .rpc();

    log('6-settle', 'Market settled', {
      signature: tx,
      market: market.strikeMarketPda.toBase58(),
      outcome: outcomeYesWins ? 'YES' : 'NO',
    });

    await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
  }
}

// ---------------------------------------------------------------------------
// Step 7: Redeem Winning Tokens
// ---------------------------------------------------------------------------

async function redeemTokens(
  program: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
  user: Keypair,
  markets: readonly MarketInfo[],
): Promise<void> {
  for (const market of markets) {
    const redeemYes = true; // We settled as YES wins
    const amount = new BN(10 * MERIDIAN_CONFIG.PAIR_COST_USDC);

    const userYes = await getAssociatedTokenAddress(
      market.yesMintPda,
      user.publicKey,
    );
    const userNo = await getAssociatedTokenAddress(
      market.noMintPda,
      user.publicKey,
    );
    const userUsdc = await getAssociatedTokenAddress(
      DEVNET_USDC_MINT,
      user.publicKey,
    );

    log('7-redeem', `Redeeming YES tokens for ${market.ticker} @ ${market.strikePriceCents}`, {
      strikeMarket: market.strikeMarketPda.toBase58(),
      amount: amount.toString(),
      redeemYes,
    });

    const tx = await program.methods
      .redeem(amount, redeemYes)
      .accountsStrict({
        user: user.publicKey,
        strikeMarket: market.strikeMarketPda,
        yesMint: market.yesMintPda,
        noMint: market.noMintPda,
        userYes,
        userNo,
        userUsdc,
        vault: market.vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    log('7-redeem', 'Tokens redeemed', {
      signature: tx,
      market: market.strikeMarketPda.toBase58(),
    });

    await sleep(MERIDIAN_CONFIG.INTER_TX_DELAY_MS);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('start', '=== Meridian Full Lifecycle Demo ===');

  const config = loadDemoConfig();
  log('start', `Using cluster: ${config.cluster}`, { rpcUrl: config.rpcUrl });

  // Setup provider + program
  const connection = new Connection(config.rpcUrl, 'confirmed');
  const admin = loadKeypair(config.adminKeypairPath);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  log('start', 'Loaded admin wallet', {
    admin: admin.publicKey.toBase58(),
    programId: PROGRAM_ID.toBase58(),
  });

  // Step 1: Initialize config
  await initializeConfig(program, admin);

  // Step 2: Register all 7 tickers
  await registerTickers(program, admin);

  // Step 3: Create strike markets for today (AAPL + NVDA)
  const markets = await createStrikeMarkets(program, admin);

  // Step 4: Mint YES+NO pairs
  await mintPairs(program, admin, markets);

  // Step 5: Place orders (simulated)
  await placeOrders(markets);

  // Step 6: Settle markets via admin_settle
  await settleMarkets(program, admin, markets);

  // Step 7: Redeem winning tokens
  await redeemTokens(program, admin, markets);

  log('done', '=== Demo complete ===', {
    marketsCreated: markets.length,
    tickers: Array.from(new Set(markets.map((m) => m.ticker))),
  });
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
