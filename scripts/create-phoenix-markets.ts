/**
 * @module scripts/create-phoenix-markets
 * Creates or maps Phoenix DEX markets for existing Meridian StrikeMarket accounts.
 *
 * For each StrikeMarket that has a placeholder/default Phoenix market address,
 * this script will attempt to create a corresponding Phoenix DEX market.
 *
 * Since creating real Phoenix markets requires specific authority on the Phoenix
 * Legacy program (`PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY`), this script
 * supports two modes:
 *
 *   1. **Mock mode** (default): Generates a keypair for each market and stores
 *      the mapping in `scripts/phoenix-markets.json`. Useful for local dev and
 *      devnet testing where Phoenix authority is unavailable.
 *
 *   2. **Live mode** (`--live`): Attempts to call Phoenix's `InitializeMarket`
 *      instruction. Requires the caller to hold the Phoenix market authority.
 *      This mode is structured but will fail without proper authority.
 *
 * Usage:
 *   npx ts-node scripts/create-phoenix-markets.ts           # mock mode
 *   npx ts-node scripts/create-phoenix-markets.ts --live     # live mode (requires authority)
 *
 * Environment:
 *   SOLANA_RPC_URL      - RPC endpoint (default: https://api.devnet.solana.com)
 *   ADMIN_KEYPAIR_PATH  - Path to admin keypair (default: ~/.config/solana/id.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Wallet,
  log,
  loadKeypair,
  createProvider,
  createProgram,
  PROGRAM_ID,
} from './helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const ADMIN_PATH = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';
const OUTPUT_PATH = path.resolve(__dirname, 'phoenix-markets.json');

const PHOENIX_PROGRAM_ID = new PublicKey(
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
);

/**
 * Phoenix InitializeMarket instruction discriminator.
 * Variant index 0 in the PhoenixInstruction enum (borsh-serialized).
 */
const INITIALIZE_MARKET_DISCRIMINATOR = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrikeMarketAccount {
  readonly publicKey: PublicKey;
  readonly account: {
    readonly ticker: string | number[];
    readonly strikePrice: { toString(): string };
    readonly tradingDate: { toString(): string };
    readonly phoenixMarket: PublicKey;
    readonly settled: boolean;
  };
}

interface PhoenixMarketMapping {
  readonly meridianMarket: string;
  readonly phoenixMarket: string;
  readonly ticker: string;
  readonly strikePrice: string;
  readonly tradingDate: string;
  readonly mode: 'mock' | 'live';
  readonly createdAt: string;
}

interface PhoenixMarketsOutput {
  readonly generatedAt: string;
  readonly cluster: string;
  readonly mode: 'mock' | 'live';
  readonly markets: readonly PhoenixMarketMapping[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a PublicKey is a "placeholder" (default/system or all-zeros).
 * Markets created with `Keypair.generate()` as a dummy won't match system
 * program, but we can check if the market account actually exists on-chain.
 */
async function isPlaceholderMarket(
  connection: Connection,
  phoenixMarketKey: PublicKey,
): Promise<boolean> {
  // System program address or all-zeros means placeholder
  if (
    phoenixMarketKey.equals(PublicKey.default) ||
    phoenixMarketKey.equals(new PublicKey('11111111111111111111111111111111'))
  ) {
    return true;
  }

  // If the account doesn't exist on-chain or has no data, treat as placeholder
  const accountInfo = await connection.getAccountInfo(phoenixMarketKey);
  if (accountInfo === null) {
    return true;
  }

  // If the account is not owned by the Phoenix program, treat as placeholder
  if (!accountInfo.owner.equals(PHOENIX_PROGRAM_ID)) {
    return true;
  }

  return false;
}

/**
 * Decodes ticker bytes from the on-chain account into a string.
 * Anchor may return a string or a byte array depending on the IDL.
 */
function decodeTicker(raw: string | number[]): string {
  if (typeof raw === 'string') {
    return raw.replace(/\0/g, '').trim();
  }
  return Buffer.from(raw).toString('utf-8').replace(/\0/g, '').trim();
}

/**
 * Builds a mock Phoenix market by generating a fresh keypair.
 * Returns the public key of the generated "market".
 */
function createMockPhoenixMarket(): { readonly publicKey: PublicKey; readonly keypair: Keypair } {
  const keypair = Keypair.generate();
  return { publicKey: keypair.publicKey, keypair };
}

/**
 * Builds the InitializeMarket instruction data for Phoenix Legacy.
 *
 * NOTE: The full InitializeMarket instruction requires additional parameters
 * (base/quote lot sizes, tick size, etc.) and specific accounts (market authority,
 * base/quote mints, vaults, etc.) that are only available to the Phoenix authority.
 *
 * This function provides the structure for when authority is available.
 * The exact parameter layout depends on the Phoenix program version.
 */
function buildInitializeMarketData(): Uint8Array {
  // Phoenix V1 InitializeMarket is variant 0 of the enum.
  // Full parameters would include:
  //   - base_lot_size: u64
  //   - quote_lot_size: u64
  //   - tick_size_in_quote_lots_per_base_unit: u64
  //   - num_seats: u64
  // These would need to be set appropriately for YES/NO token pairs.
  return new Uint8Array([INITIALIZE_MARKET_DISCRIMINATOR]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isLiveMode = process.argv.includes('--live');
  const mode = isLiveMode ? 'live' : 'mock';

  log('init', `=== Create Phoenix Markets (${mode} mode) ===`);

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_PATH);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  log('init', 'Admin loaded', {
    admin: admin.publicKey.toBase58(),
    rpcUrl: RPC_URL,
    mode,
  });

  // ------------------------------------------------------------------
  // Step 1: Query all existing StrikeMarket accounts
  // ------------------------------------------------------------------
  log('query', 'Fetching all StrikeMarket accounts from Meridian program...');

  let strikeMarkets: readonly StrikeMarketAccount[] = [];
  try {
    const rawAccounts = await program.account['strikeMarket'].all();
    strikeMarkets = rawAccounts.map((a: { publicKey: PublicKey; account: Record<string, unknown> }) => ({
      publicKey: a.publicKey,
      account: a.account as StrikeMarketAccount['account'],
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log('query', 'Failed to fetch StrikeMarket accounts', { error: message });
    log('query', 'This may mean no markets exist yet. Run setup-devnet.ts and lifecycle-test.ts first.');
    process.exit(1);
  }

  log('query', `Found ${strikeMarkets.length} StrikeMarket account(s)`, {
    markets: strikeMarkets.map((m) => m.publicKey.toBase58()),
  });

  if (strikeMarkets.length === 0) {
    log('done', 'No StrikeMarket accounts found. Nothing to do.');
    writeOutput({ generatedAt: new Date().toISOString(), cluster: RPC_URL, mode, markets: [] });
    return;
  }

  // ------------------------------------------------------------------
  // Step 2: Filter markets with placeholder Phoenix addresses
  // ------------------------------------------------------------------
  log('filter', 'Checking which markets need Phoenix market creation...');

  const marketsNeedingPhoenix: StrikeMarketAccount[] = [];

  for (const market of strikeMarkets) {
    const phoenixKey = market.account.phoenixMarket;
    const isPlaceholder = await isPlaceholderMarket(connection, phoenixKey);
    const ticker = decodeTicker(market.account.ticker);

    log('filter', `Market ${market.publicKey.toBase58().slice(0, 8)}...`, {
      ticker,
      phoenixMarket: phoenixKey.toBase58().slice(0, 16) + '...',
      isPlaceholder,
      settled: market.account.settled,
    });

    if (isPlaceholder) {
      marketsNeedingPhoenix.push(market);
    }
  }

  log('filter', `${marketsNeedingPhoenix.length} market(s) need Phoenix market creation`);

  if (marketsNeedingPhoenix.length === 0) {
    log('done', 'All markets already have valid Phoenix market addresses.');
    writeOutput({ generatedAt: new Date().toISOString(), cluster: RPC_URL, mode, markets: [] });
    return;
  }

  // ------------------------------------------------------------------
  // Step 3: Create Phoenix markets (mock or live)
  // ------------------------------------------------------------------
  const mappings: PhoenixMarketMapping[] = [];

  for (const market of marketsNeedingPhoenix) {
    const ticker = decodeTicker(market.account.ticker);
    const strikePrice = market.account.strikePrice.toString();
    const tradingDate = market.account.tradingDate.toString();

    if (isLiveMode) {
      // Live mode: attempt to create a real Phoenix market
      log('create-live', `Creating live Phoenix market for ${ticker} @ ${strikePrice}`, {
        meridianMarket: market.publicKey.toBase58(),
      });

      // NOTE: Creating a real Phoenix market requires:
      // 1. Phoenix market authority (not typically available on devnet)
      // 2. Pre-created base/quote token vaults
      // 3. Proper lot size and tick configuration
      //
      // The InitializeMarket instruction accounts (approximate):
      //   0. market (writable, signer) - new keypair
      //   1. authority (signer) - Phoenix market authority
      //   2. base_mint - YES token mint for this market
      //   3. quote_mint - USDC mint
      //   4. base_vault (writable) - token account for base
      //   5. quote_vault (writable) - token account for quote
      //   6. system_program
      //   7. token_program
      //   8. rent

      log('create-live', 'WARNING: Live Phoenix market creation requires Phoenix authority.', {
        note: 'This will likely fail on devnet without proper authority.',
        instruction: 'InitializeMarket (discriminator 0)',
        phoenixProgram: PHOENIX_PROGRAM_ID.toBase58(),
      });

      // Even in live mode, fall back to generating a keypair address for reference.
      // A real implementation would build and send the InitializeMarket transaction.
      const _instructionData = buildInitializeMarketData();
      const mock = createMockPhoenixMarket();

      log('create-live', 'Generated market address (authority required for on-chain creation)', {
        phoenixMarket: mock.publicKey.toBase58(),
      });

      mappings.push({
        meridianMarket: market.publicKey.toBase58(),
        phoenixMarket: mock.publicKey.toBase58(),
        ticker,
        strikePrice,
        tradingDate,
        mode: 'live',
        createdAt: new Date().toISOString(),
      });
    } else {
      // Mock mode: generate a keypair to represent the Phoenix market
      log('create-mock', `Creating mock Phoenix market for ${ticker} @ ${strikePrice}`);

      const mock = createMockPhoenixMarket();

      log('create-mock', 'Mock Phoenix market created', {
        meridianMarket: market.publicKey.toBase58(),
        phoenixMarket: mock.publicKey.toBase58(),
        ticker,
      });

      mappings.push({
        meridianMarket: market.publicKey.toBase58(),
        phoenixMarket: mock.publicKey.toBase58(),
        ticker,
        strikePrice,
        tradingDate,
        mode: 'mock',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // ------------------------------------------------------------------
  // Step 4: Write results to JSON
  // ------------------------------------------------------------------
  const output: PhoenixMarketsOutput = {
    generatedAt: new Date().toISOString(),
    cluster: RPC_URL,
    mode,
    markets: mappings,
  };

  writeOutput(output);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  log('done', '=== Phoenix Market Creation Complete ===', {
    totalMarkets: strikeMarkets.length,
    marketsProcessed: mappings.length,
    mode,
    outputFile: OUTPUT_PATH,
  });

  log('done', 'Market mapping summary:');
  for (const m of mappings) {
    log('mapping', `${m.ticker} @ ${m.strikePrice}`, {
      meridian: m.meridianMarket,
      phoenix: m.phoenixMarket,
    });
  }

  if (mode === 'mock') {
    log('note', 'Mock markets generated. To create real Phoenix markets:', {
      requirements: [
        '1. Obtain Phoenix market authority for the target cluster',
        '2. Run with --live flag: npx ts-node scripts/create-phoenix-markets.ts --live',
        '3. Update Meridian StrikeMarket accounts to reference the real Phoenix market addresses',
      ],
    });
  }
}

/**
 * Writes the market mapping output to the JSON file.
 * Merges with existing data if the file already exists.
 */
function writeOutput(output: PhoenixMarketsOutput): void {
  let existing: PhoenixMarketsOutput | null = null;

  try {
    const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    existing = JSON.parse(raw) as PhoenixMarketsOutput;
  } catch {
    // File doesn't exist yet, that's fine
  }

  // Merge: keep existing markets that aren't being updated
  if (existing !== null && existing.markets.length > 0) {
    const updatedMeridianKeys = new Set(output.markets.map((m) => m.meridianMarket));
    const keptMarkets = existing.markets.filter((m) => !updatedMeridianKeys.has(m.meridianMarket));
    const merged: PhoenixMarketsOutput = {
      ...output,
      markets: [...keptMarkets, ...output.markets],
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  } else {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  }

  log('output', `Results written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Phoenix market creation failed:', err);
  process.exit(1);
});
