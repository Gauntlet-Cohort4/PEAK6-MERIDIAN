/**
 * @module scripts/create-phoenix-markets
 * Creates real Phoenix DEX markets on Solana devnet for Meridian strike markets.
 *
 * Phoenix V1 InitializeMarket is permissionless — any signer can create a market.
 * The signer becomes the market authority and fee recipient.
 *
 * For each YES/NO token pair in a Meridian strike market, this script creates
 * a Phoenix order book where the YES token is the base and USDC is the quote.
 *
 * Usage:
 *   npx ts-node scripts/create-phoenix-markets.ts
 *
 * Environment:
 *   SOLANA_RPC_URL      - RPC endpoint (default: https://api.devnet.solana.com)
 *   ADMIN_KEYPAIR_PATH  - Path to admin keypair (default: ~/.config/solana/id.json)
 */

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
  SystemProgram,
  TOKEN_PROGRAM_ID,
  sleep,
} from './helpers';
import {
  initializeParamsBeet,
  marketSizeParamsBeet,
} from '@ellipsis-labs/phoenix-sdk';
import { TransactionInstruction, Transaction } from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const ADMIN_PATH = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';

const PHOENIX_PROGRAM_ID = new PublicKey(
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
);

/** Phoenix log authority PDA — seeds: [b"log"] */
const PHOENIX_LOG_AUTHORITY = new PublicKey(
  '7aDTsspkQNGKmrexAN7FLx9oxU3iPczSSvHNggyuqYkR',
);

/** InitializeMarket instruction discriminant in Phoenix V1 */
const INITIALIZE_MARKET_DISCRIMINANT = 100;

/**
 * Smallest valid market size: 512 bids, 512 asks, 128 seats.
 * Account size ≈ 82,896 bytes → rent ≈ 0.58 SOL per market.
 */
const MARKET_SIZE_PARAMS = {
  bidsSize: BigInt(512),
  asksSize: BigInt(512),
  numSeats: BigInt(128),
};

/**
 * Market account size in bytes for (512, 512, 128) config.
 * Derived from on-chain error: Phoenix requires 84,368 bytes for the FIFOMarket
 * portion + 576 bytes for the MarketHeader = 84,944. Add padding for safety.
 */
const MARKET_ACCOUNT_SIZE = 85_008;

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
    readonly yesMint: PublicKey;
    readonly settled: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeTicker(raw: string | number[]): string {
  if (typeof raw === 'string') {
    return raw.replace(/\0/g, '').trim();
  }
  return Buffer.from(raw).toString('utf-8').replace(/\0/g, '').trim();
}

async function isPlaceholderMarket(
  connection: Connection,
  phoenixMarketKey: PublicKey,
): Promise<boolean> {
  if (
    phoenixMarketKey.equals(PublicKey.default) ||
    phoenixMarketKey.equals(new PublicKey('11111111111111111111111111111111'))
  ) {
    return true;
  }

  const accountInfo = await connection.getAccountInfo(phoenixMarketKey);
  if (accountInfo === null) {
    return true;
  }

  if (!accountInfo.owner.equals(PHOENIX_PROGRAM_ID)) {
    return true;
  }

  return false;
}

/**
 * Derives the Phoenix vault PDA for a given market + mint.
 * Seeds: [b"vault", market_pubkey, mint_pubkey]
 */
function derivePhoenixVault(
  marketKey: PublicKey,
  mintKey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), marketKey.toBuffer(), mintKey.toBuffer()],
    PHOENIX_PROGRAM_ID,
  );
}

/**
 * Builds the InitializeMarket transaction for a Phoenix V1 market.
 *
 * Steps:
 * 1. SystemProgram.createAccount to allocate the market account (owned by Phoenix)
 * 2. Phoenix InitializeMarket instruction with params
 */
function buildInitializeMarketTx(
  marketKeypair: Keypair,
  creator: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  rentLamports: number,
): Transaction {
  // Step 1: Allocate the market account owned by Phoenix program
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: creator,
    newAccountPubkey: marketKeypair.publicKey,
    lamports: rentLamports,
    space: MARKET_ACCOUNT_SIZE,
    programId: PHOENIX_PROGRAM_ID,
  });

  // Step 2: Build InitializeMarket instruction data
  // Phoenix constraint: tickSize % numBaseLotsPerBaseUnit == 0
  // For YES/NO tokens (6 decimals) priced in USDC (6 decimals), $0.00-$1.00:
  //   - 1 base unit = 1 YES token = 10^6 atoms
  //   - 1 quote unit = 1 USDC = 10^6 atoms
  //   - numBaseLotsPerBaseUnit=100 → 1 base lot = 10,000 atoms = 0.01 tokens
  //   - numQuoteLotsPerQuoteUnit=100 → 1 quote lot = 10,000 atoms = $0.01
  //   - tickSize=100 → each tick = 100 quote lots / 100 base lots per unit = $0.01
  //   - Price range: tick 1 = $0.01 to tick 100 = $1.00 (100 price levels)
  const initParams = {
    marketSizeParams: MARKET_SIZE_PARAMS,
    numQuoteLotsPerQuoteUnit: BigInt(100),
    tickSizeInQuoteLotsPerBaseUnit: BigInt(100),
    numBaseLotsPerBaseUnit: BigInt(100),
    takerFeeBps: 0,
    feeCollector: creator,
    rawBaseUnitsPerBaseUnit: null,
  };

  const [paramsBuffer] = initializeParamsBeet.serialize(initParams);
  const data = Buffer.concat([
    Buffer.from([INITIALIZE_MARKET_DISCRIMINANT]),
    paramsBuffer,
  ]);

  // Derive vault PDAs
  const [baseVault] = derivePhoenixVault(marketKeypair.publicKey, baseMint);
  const [quoteVault] = derivePhoenixVault(marketKeypair.publicKey, quoteMint);

  const initMarketIx = new TransactionInstruction({
    programId: PHOENIX_PROGRAM_ID,
    keys: [
      { pubkey: PHOENIX_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: PHOENIX_LOG_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: marketKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: baseMint, isSigner: false, isWritable: false },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: baseVault, isSigner: false, isWritable: true },
      { pubkey: quoteVault, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction();
  tx.add(createAccountIx);
  tx.add(initMarketIx);

  return tx;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('init', '=== Create Phoenix Markets (permissionless) ===');

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_PATH);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  const balance = await connection.getBalance(admin.publicKey);
  log('init', 'Admin loaded', {
    admin: admin.publicKey.toBase58(),
    balanceSol: balance / 1e9,
    rpcUrl: RPC_URL,
  });

  // Calculate rent for market account
  const rentLamports = await connection.getMinimumBalanceForRentExemption(MARKET_ACCOUNT_SIZE);
  log('init', 'Market account rent', {
    sizeBytes: MARKET_ACCOUNT_SIZE,
    rentSol: (rentLamports / 1e9).toFixed(4),
  });

  // ------------------------------------------------------------------
  // Step 1: Query all existing StrikeMarket accounts
  // ------------------------------------------------------------------
  log('query', 'Fetching StrikeMarket accounts...');

  let strikeMarkets: StrikeMarketAccount[] = [];
  try {
    const rawAccounts = await program.account['strikeMarket'].all();
    strikeMarkets = rawAccounts.map((a: { publicKey: PublicKey; account: Record<string, unknown> }) => ({
      publicKey: a.publicKey,
      account: a.account as StrikeMarketAccount['account'],
    }));
  } catch (err: unknown) {
    log('query', 'Failed to fetch StrikeMarket accounts', {
      error: err instanceof Error ? err.message : String(err),
    });
    log('query', 'Run setup-devnet.ts and lifecycle-test.ts first.');
    process.exit(1);
  }

  log('query', `Found ${strikeMarkets.length} StrikeMarket(s)`);

  if (strikeMarkets.length === 0) {
    log('done', 'No StrikeMarket accounts found.');
    return;
  }

  // ------------------------------------------------------------------
  // Step 2: Filter markets needing Phoenix creation
  // ------------------------------------------------------------------
  const marketsNeedingPhoenix: StrikeMarketAccount[] = [];

  for (const market of strikeMarkets) {
    const isPlaceholder = await isPlaceholderMarket(connection, market.account.phoenixMarket);
    if (isPlaceholder && !market.account.settled) {
      marketsNeedingPhoenix.push(market);
    }
  }

  log('filter', `${marketsNeedingPhoenix.length} unsettled market(s) need Phoenix creation`);

  if (marketsNeedingPhoenix.length === 0) {
    log('done', 'All markets already have valid Phoenix addresses or are settled.');
    return;
  }

  // Check we have enough SOL
  const totalRentNeeded = marketsNeedingPhoenix.length * rentLamports;
  const txFeeEstimate = marketsNeedingPhoenix.length * 10000; // ~0.00001 SOL per tx
  if (balance < totalRentNeeded + txFeeEstimate) {
    log('error', 'Insufficient SOL for Phoenix market creation', {
      needed: ((totalRentNeeded + txFeeEstimate) / 1e9).toFixed(4),
      available: (balance / 1e9).toFixed(4),
      markets: marketsNeedingPhoenix.length,
    });
    process.exit(1);
  }

  // ------------------------------------------------------------------
  // Step 3: Create real Phoenix markets
  // ------------------------------------------------------------------
  const created: Array<{ ticker: string; strikePrice: string; phoenixMarket: string }> = [];

  // We need a quote mint (USDC). Get it from the first market's vault.
  // The strike market stores the USDC mint used during creation.
  // For now, use the devnet USDC mint from helpers.
  const { DEVNET_USDC_MINT } = await import('./helpers');
  const quoteMint = DEVNET_USDC_MINT;

  for (const market of marketsNeedingPhoenix) {
    const ticker = decodeTicker(market.account.ticker);
    const strikePrice = market.account.strikePrice.toString();
    const baseMint = market.account.yesMint; // YES token is the base

    const marketKeypair = Keypair.generate();

    log('create', `Creating Phoenix market: ${ticker} @ $${(Number(strikePrice) / 100).toFixed(2)}`, {
      baseMint: baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      phoenixMarket: marketKeypair.publicKey.toBase58(),
    });

    try {
      const tx = buildInitializeMarketTx(
        marketKeypair,
        admin.publicKey,
        baseMint,
        quoteMint,
        rentLamports,
      );

      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(admin, marketKeypair);

      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
      });
      await connection.confirmTransaction(sig, 'confirmed');

      log('create', `Phoenix market created: ${ticker} @ ${strikePrice}`, {
        signature: sig,
        phoenixMarket: marketKeypair.publicKey.toBase58(),
      });

      created.push({
        ticker,
        strikePrice,
        phoenixMarket: marketKeypair.publicKey.toBase58(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log('create', `FAILED to create Phoenix market for ${ticker} @ ${strikePrice}`, {
        error: message,
      });
    }

    await sleep(500);
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  log('done', '=== Phoenix Market Creation Complete ===', {
    total: marketsNeedingPhoenix.length,
    created: created.length,
    failed: marketsNeedingPhoenix.length - created.length,
  });

  for (const m of created) {
    log('summary', `${m.ticker} @ $${(Number(m.strikePrice) / 100).toFixed(2)}`, {
      phoenixMarket: m.phoenixMarket,
    });
  }

  if (created.length > 0) {
    log('note', 'Phoenix markets created but Meridian StrikeMarket accounts still reference placeholders.', {
      nextStep: 'Update StrikeMarket.phoenix_market field via admin instruction or redeploy markets with correct addresses.',
    });
  }
}

main().catch((err) => {
  console.error('Phoenix market creation failed:', err);
  process.exit(1);
});
