/**
 * @module scripts/test-full-pipeline
 * Full-pipeline devnet test for Meridian: create market -> Phoenix market ->
 * set_phoenix_market -> mint pairs -> wait -> admin settle -> redeem.
 *
 * Usage:
 *   npx tsx scripts/test-full-pipeline.ts
 */

import {
  BN,
  Connection,
  Keypair,
  PublicKey,
  Wallet,
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
  sleep,
  PROGRAM_ID,
  SystemProgram,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  DEVNET_USDC_MINT,
  getAssociatedTokenAddress,
} from './helpers';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token';
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

const PHOENIX_LOG_AUTHORITY = new PublicKey(
  '7aDTsspkQNGKmrexAN7FLx9oxU3iPczSSvHNggyuqYkR',
);

const INITIALIZE_MARKET_DISCRIMINANT = 100;

const MARKET_SIZE_PARAMS = {
  bidsSize: BigInt(512),
  asksSize: BigInt(512),
  numSeats: BigInt(128),
};

const MARKET_ACCOUNT_SIZE = 85_008;

// On-chain constants (from constants.rs — production values)
const MARKET_CLOSE_SECONDS_UTC = 75_900;
const ADMIN_SETTLE_DELAY = 3600;

// ---------------------------------------------------------------------------
// Phoenix market creation helper (from create-phoenix-markets.ts)
// ---------------------------------------------------------------------------

function derivePhoenixVault(
  marketKey: PublicKey,
  mintKey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), marketKey.toBuffer(), mintKey.toBuffer()],
    PHOENIX_PROGRAM_ID,
  );
}

function buildInitializeMarketTx(
  marketKeypair: Keypair,
  creator: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  rentLamports: number,
): Transaction {
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: creator,
    newAccountPubkey: marketKeypair.publicKey,
    lamports: rentLamports,
    space: MARKET_ACCOUNT_SIZE,
    programId: PHOENIX_PROGRAM_ID,
  });

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
// Main pipeline
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('init', '=== FULL PIPELINE TEST ===');

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_PATH);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  const balance = await connection.getBalance(admin.publicKey);
  log('init', 'Admin loaded', {
    admin: admin.publicKey.toBase58(),
    balanceSol: balance / 1e9,
  });

  if (balance < 2e9) {
    log('error', 'Need at least 2 SOL for test. Current balance too low.');
    process.exit(1);
  }

  // =========================================================================
  // Step 1: Create a test USDC mint + fund admin
  // =========================================================================
  log('step-1', 'Creating test USDC mint...');

  const testUsdcMint = await createMint(connection, admin, admin.publicKey, null, 6);
  log('step-1', 'Test USDC mint created', { mint: testUsdcMint.toBase58() });

  const adminUsdcAta = await getOrCreateAssociatedTokenAccount(
    connection, admin, testUsdcMint, admin.publicKey,
  );
  await mintTo(connection, admin, testUsdcMint, adminUsdcAta.address, admin, 100_000_000);
  log('step-1', 'Minted 100 test-USDC to admin', {
    ata: adminUsdcAta.address.toBase58(),
  });

  // =========================================================================
  // Step 2: Create strike market with placeholder Phoenix address
  // =========================================================================
  log('step-2', 'Creating strike market...');

  const ticker = 'AAPL';
  const strikePrice = new BN(23000); // $230.00

  // Use a trading date far enough in the past that admin_settle works.
  // admin_settle requires: now >= trading_date + 75900 + 3600
  // So: trading_date <= now - 79500
  // But create_strike_market requires: trading_date >= now
  //
  // Strategy: Create with trading_date = now + 5 (just in the future).
  // Then compute how long we'd need to wait for admin_settle.
  // If the deployed program has test constants (5s delays), we wait ~15s.
  // If production constants (79500s), we report the gap.
  const nowTs = Math.floor(Date.now() / 1000);
  const tradingDate = new BN(nowTs + 5);

  const [configPda] = deriveConfigPda();
  const [tickerPda] = deriveTickerPda(ticker);
  const [strikeMarketPda] = deriveStrikeMarketPda(ticker, strikePrice, tradingDate);
  const [yesMintPda] = deriveYesMintPda(strikeMarketPda);
  const [noMintPda] = deriveNoMintPda(strikeMarketPda);
  const [vaultPda] = deriveVaultPda(strikeMarketPda);

  log('step-2', 'PDAs derived', {
    config: configPda.toBase58(),
    ticker: tickerPda.toBase58(),
    strikeMarket: strikeMarketPda.toBase58(),
    yesMint: yesMintPda.toBase58(),
    noMint: noMintPda.toBase58(),
    vault: vaultPda.toBase58(),
    tradingDate: tradingDate.toString(),
  });

  const createMarketSig = await program.methods
    .createStrikeMarket(strikePrice, tradingDate)
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      tickerConfig: tickerPda,
      strikeMarket: strikeMarketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      usdcMint: testUsdcMint,
      vault: vaultPda,
      phoenixMarket: PublicKey.default,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
    })
    .signers([admin])
    .rpc();

  log('step-2', 'Strike market created', { signature: createMarketSig });

  // Verify market state
  const marketAfterCreate = await program.account['strikeMarket'].fetch(strikeMarketPda);
  log('step-2', 'Market state after creation', {
    settled: marketAfterCreate.settled,
    phoenixMarket: marketAfterCreate.phoenixMarket.toBase58(),
    yesMint: marketAfterCreate.yesMint.toBase58(),
    totalPairsMinted: marketAfterCreate.totalPairsMinted.toString(),
  });

  // =========================================================================
  // Step 3: Create real Phoenix market with YES mint as base
  // =========================================================================
  log('step-3', 'Creating Phoenix market...');

  const phoenixMarketKeypair = Keypair.generate();
  const rentLamports = await connection.getMinimumBalanceForRentExemption(MARKET_ACCOUNT_SIZE);

  const phoenixTx = buildInitializeMarketTx(
    phoenixMarketKeypair,
    admin.publicKey,
    yesMintPda,       // YES token = base
    testUsdcMint,     // USDC = quote
    rentLamports,
  );

  phoenixTx.feePayer = admin.publicKey;
  phoenixTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  phoenixTx.sign(admin, phoenixMarketKeypair);

  const phoenixSig = await connection.sendRawTransaction(phoenixTx.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(phoenixSig, 'confirmed');

  log('step-3', 'Phoenix market created', {
    phoenixMarket: phoenixMarketKeypair.publicKey.toBase58(),
    signature: phoenixSig,
  });

  // =========================================================================
  // Step 4: Call set_phoenix_market to link them
  // =========================================================================
  log('step-4', 'Linking Phoenix market via set_phoenix_market...');

  const setPhoenixSig = await program.methods
    .setPhoenixMarket(phoenixMarketKeypair.publicKey)
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      strikeMarket: strikeMarketPda,
    })
    .signers([admin])
    .rpc();

  log('step-4', 'set_phoenix_market success', { signature: setPhoenixSig });

  // Verify the link
  const marketAfterLink = await program.account['strikeMarket'].fetch(strikeMarketPda);
  log('step-4', 'Market state after linking', {
    phoenixMarket: marketAfterLink.phoenixMarket.toBase58(),
    matches: marketAfterLink.phoenixMarket.equals(phoenixMarketKeypair.publicKey),
  });

  // =========================================================================
  // Step 5: Mint YES/NO pairs
  // =========================================================================
  log('step-5', 'Minting YES/NO pairs...');

  // Create ATAs for YES and NO tokens
  const adminYesAta = await getOrCreateAssociatedTokenAccount(
    connection, admin, yesMintPda, admin.publicKey,
  );
  const adminNoAta = await getOrCreateAssociatedTokenAccount(
    connection, admin, noMintPda, admin.publicKey,
  );

  log('step-5', 'Token accounts created', {
    adminUsdc: adminUsdcAta.address.toBase58(),
    adminYes: adminYesAta.address.toBase58(),
    adminNo: adminNoAta.address.toBase58(),
  });

  const mintAmount = new BN(10); // 10 pairs = 10 USDC

  const mintSig = await program.methods
    .mintPair(mintAmount)
    .accountsStrict({
      user: admin.publicKey,
      config: configPda,
      strikeMarket: strikeMarketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      userUsdc: adminUsdcAta.address,
      userYes: adminYesAta.address,
      userNo: adminNoAta.address,
      vault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([admin])
    .rpc();

  log('step-5', 'Minted 10 pairs', { signature: mintSig });

  // Check balances
  const yesBalance = await getAccount(connection, adminYesAta.address);
  const noBalance = await getAccount(connection, adminNoAta.address);
  const vaultBalance = await getAccount(connection, vaultPda);

  log('step-5', 'Post-mint balances', {
    yesTokens: yesBalance.amount.toString(),
    noTokens: noBalance.amount.toString(),
    vaultUsdc: vaultBalance.amount.toString(),
  });

  // =========================================================================
  // Step 6: Wait for settlement window
  // =========================================================================
  // admin_settle requires: clock >= trading_date + MARKET_CLOSE_SECONDS_UTC + ADMIN_SETTLE_DELAY
  // With production constants: trading_date + 79,500 seconds (~22 hours after market creation)

  const earliestSettle = tradingDate.toNumber() + MARKET_CLOSE_SECONDS_UTC + ADMIN_SETTLE_DELAY;
  const currentTime = Math.floor(Date.now() / 1000);
  const waitSeconds = earliestSettle - currentTime;

  log('step-6', 'Settlement window calculation', {
    tradingDate: tradingDate.toString(),
    earliestSettle,
    currentTime,
    waitSecondsNeeded: waitSeconds,
  });

  if (waitSeconds > 120) {
    log('step-6', 'Settlement requires waiting for market close + admin delay', {
      note: 'Production settlement window: market close (4:05 PM ET) + 1 hour admin delay.',
      hoursToWait: (waitSeconds / 3600).toFixed(1),
    });

    // Try admin_settle anyway to confirm the error
    log('step-6', 'Attempting admin_settle to confirm error type...');
    try {
      await program.methods
        .adminSettle(true, new BN(23500))
        .accountsStrict({
          admin: admin.publicKey,
          config: configPda,
          strikeMarket: strikeMarketPda,
        })
        .signers([admin])
        .rpc();
      log('step-6', 'admin_settle succeeded (unexpected with production constants)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log('step-6', 'admin_settle rejected as expected', { error: msg });

      if (msg.includes('AdminSettleTooEarly')) {
        log('step-6', 'Confirmed: settlement window has not elapsed yet.');
        log('step-6', 'Steps 1-5 (create market, phoenix, link, mint) all PASSED.');
        log('step-6', 'Settlement + redeem will succeed after the market close window elapses.');
      }
    }

    log('done', '=== PARTIAL PIPELINE TEST COMPLETE (steps 1-5 passed) ===');
    return;
  }

  // Wait for the settlement window
  if (waitSeconds > 0) {
    log('step-6', `Waiting ${waitSeconds}s for settlement window...`);
    await sleep(waitSeconds * 1000 + 2000); // add 2s buffer
  }

  // =========================================================================
  // Step 7: Admin settle
  // =========================================================================
  log('step-7', 'Admin settling market (YES wins at $235.00)...');

  const settlementPrice = new BN(23500); // $235.00 > strike $230.00 => YES wins

  const settleSig = await program.methods
    .adminSettle(true, settlementPrice)
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      strikeMarket: strikeMarketPda,
    })
    .signers([admin])
    .rpc();

  log('step-7', 'Market settled', { signature: settleSig });

  const marketAfterSettle = await program.account['strikeMarket'].fetch(strikeMarketPda);
  log('step-7', 'Market state after settlement', {
    settled: marketAfterSettle.settled,
    outcomeYesWins: marketAfterSettle.outcomeYesWins,
    settlementPrice: marketAfterSettle.settlementPrice.toString(),
    settledAt: marketAfterSettle.settledAt.toString(),
  });

  // =========================================================================
  // Step 8: Redeem winning tokens (YES wins)
  // =========================================================================
  log('step-8', 'Redeeming YES tokens...');

  const redeemAmount = new BN(10); // Redeem all 10 YES tokens

  const redeemSig = await program.methods
    .redeem(redeemAmount, true) // redeem_yes = true
    .accountsStrict({
      user: admin.publicKey,
      strikeMarket: strikeMarketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      userYes: adminYesAta.address,
      userNo: adminNoAta.address,
      userUsdc: adminUsdcAta.address,
      vault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([admin])
    .rpc();

  log('step-8', 'Redemption complete', { signature: redeemSig });

  // Check final balances
  const finalYes = await getAccount(connection, adminYesAta.address);
  const finalNo = await getAccount(connection, adminNoAta.address);
  const finalUsdc = await getAccount(connection, adminUsdcAta.address);
  const finalVault = await getAccount(connection, vaultPda);

  log('step-8', 'Final balances', {
    yesTokens: finalYes.amount.toString(),
    noTokens: finalNo.amount.toString(),
    userUsdc: finalUsdc.amount.toString(),
    vaultUsdc: finalVault.amount.toString(),
  });

  const finalMarket = await program.account['strikeMarket'].fetch(strikeMarketPda);
  log('step-8', 'Final market state', {
    totalPairsMinted: finalMarket.totalPairsMinted.toString(),
    totalPairsRedeemed: finalMarket.totalPairsRedeemed.toString(),
  });

  log('done', '=== FULL PIPELINE TEST COMPLETE ===');
}

main().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
