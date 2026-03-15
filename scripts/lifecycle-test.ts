/**
 * @module scripts/lifecycle-test
 * Full lifecycle E2E test on devnet:
 *   1. Create a test token mint (our own "USDC" since we need mint authority)
 *   2. Mint test tokens to admin
 *   3. Create a strike market for AAPL
 *   4. Create YES/NO ATAs for admin
 *   5. Mint 1 pair (deposit 1 test-USDC, receive 1 YES + 1 NO)
 *   6. Wait for market close + admin settle delay (~15s with test constants)
 *   7. Admin settle (YES wins)
 *   8. Redeem YES tokens (get 1 test-USDC back from vault)
 *
 * Requirements:
 *   - Program deployed with reduced MARKET_CLOSE_SECONDS_UTC=5, ADMIN_SETTLE_DELAY=5
 *   - Config PDA + AAPL ticker already registered (via setup-devnet.ts)
 *
 * Usage:
 *   npx ts-node scripts/lifecycle-test.ts
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
} from './helpers';
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const ADMIN_PATH = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';

/** Number of pairs to mint (1 pair = 1 test-USDC). Keep minimal to save SOL. */
const PAIRS_TO_MINT = 1;

/** Strike price in cents ($225.00). */
const STRIKE_PRICE_CENTS = 22500;

/** Settlement price in cents ($228.50 — above strike, so YES wins). */
const SETTLEMENT_PRICE_CENTS = 22850;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('start', '=== Meridian Lifecycle Test ===');

  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_PATH);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  const balanceBefore = await connection.getBalance(admin.publicKey);
  log('start', 'Admin loaded', {
    admin: admin.publicKey.toBase58(),
    balanceSol: balanceBefore / 1e9,
  });

  // ------------------------------------------------------------------
  // Step 1: Create test token mint (acts as our "USDC" for this test)
  // ------------------------------------------------------------------
  log('1-mint', 'Creating test token mint (6 decimals)');

  const testMint = await createMint(
    connection,
    admin,           // payer
    admin.publicKey,  // mint authority
    null,             // freeze authority
    6,                // decimals (same as USDC)
  );
  log('1-mint', 'Test mint created', { mint: testMint.toBase58() });

  // ------------------------------------------------------------------
  // Step 2: Create admin ATA for test mint and mint tokens
  // ------------------------------------------------------------------
  log('2-fund', 'Creating admin ATA and minting test tokens');

  const adminTestAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    testMint,
    admin.publicKey,
  );
  log('2-fund', 'Admin ATA created', { ata: adminTestAta.address.toBase58() });

  // Mint enough for 1 pair = 1_000_000 base units
  const mintAmount = PAIRS_TO_MINT * 1_000_000;
  await mintTo(
    connection,
    admin,
    testMint,
    adminTestAta.address,
    admin,
    mintAmount,
  );
  log('2-fund', 'Test tokens minted', { amount: mintAmount });

  // ------------------------------------------------------------------
  // Step 3: Create strike market
  // ------------------------------------------------------------------
  // Use a trading date a few seconds in the future so create_strike_market passes
  const tradingDateUnix = Math.floor(Date.now() / 1000) + 5;
  const tradingDate = new BN(tradingDateUnix);
  const strikePrice = new BN(STRIKE_PRICE_CENTS);

  const ticker = 'AAPL';
  const [configPda] = deriveConfigPda();
  const [tickerPda] = deriveTickerPda(ticker);
  const [strikeMarketPda] = deriveStrikeMarketPda(ticker, strikePrice, tradingDate);
  const [yesMintPda] = deriveYesMintPda(strikeMarketPda);
  const [noMintPda] = deriveNoMintPda(strikeMarketPda);
  const [vaultPda] = deriveVaultPda(strikeMarketPda);

  // Use a dummy Phoenix market keypair (not used for this test)
  const phoenixMarket = Keypair.generate();

  log('3-create', 'Creating strike market', {
    ticker,
    strikePriceCents: STRIKE_PRICE_CENTS,
    tradingDate: tradingDateUnix,
    strikeMarket: strikeMarketPda.toBase58(),
  });

  const createTx = await program.methods
    .createStrikeMarket(strikePrice, tradingDate)
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      tickerConfig: tickerPda,
      strikeMarket: strikeMarketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      usdcMint: testMint,
      vault: vaultPda,
      phoenixMarket: phoenixMarket.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
    })
    .signers([admin])
    .rpc();

  log('3-create', 'Strike market created', { signature: createTx });

  // ------------------------------------------------------------------
  // Step 4: Create YES/NO ATAs for admin
  // ------------------------------------------------------------------
  log('4-ata', 'Creating YES/NO token accounts');

  const adminYesAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    yesMintPda,
    admin.publicKey,
  );

  const adminNoAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    noMintPda,
    admin.publicKey,
  );

  log('4-ata', 'ATAs created', {
    yesAta: adminYesAta.address.toBase58(),
    noAta: adminNoAta.address.toBase58(),
  });

  // ------------------------------------------------------------------
  // Step 5: Mint 1 pair
  // ------------------------------------------------------------------
  log('5-pair', `Minting ${PAIRS_TO_MINT} pair(s)`);

  const pairTx = await program.methods
    .mintPair(new BN(PAIRS_TO_MINT))
    .accountsStrict({
      user: admin.publicKey,
      config: configPda,
      strikeMarket: strikeMarketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      userUsdc: adminTestAta.address,
      userYes: adminYesAta.address,
      userNo: adminNoAta.address,
      vault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([admin])
    .rpc();

  log('5-pair', 'Pair minted', { signature: pairTx });

  // Verify balances
  const yesBalance = await connection.getTokenAccountBalance(adminYesAta.address);
  const noBalance = await connection.getTokenAccountBalance(adminNoAta.address);
  const vaultBalance = await connection.getTokenAccountBalance(vaultPda);
  log('5-pair', 'Balances after mint', {
    yes: yesBalance.value.uiAmountString,
    no: noBalance.value.uiAmountString,
    vault: vaultBalance.value.uiAmountString,
  });

  // ------------------------------------------------------------------
  // Step 6: Wait for market close + admin settle delay
  // ------------------------------------------------------------------
  // With test constants: MARKET_CLOSE=5s + ADMIN_SETTLE_DELAY=5s = 10s from tradingDate
  const waitSeconds = (tradingDateUnix + 10 + 5) - Math.floor(Date.now() / 1000);
  if (waitSeconds > 0) {
    log('6-wait', `Waiting ${waitSeconds}s for settlement window...`);
    await sleep(waitSeconds * 1000);
  }

  // ------------------------------------------------------------------
  // Step 7: Admin settle (YES wins)
  // ------------------------------------------------------------------
  log('7-settle', 'Admin settling market (YES wins)', {
    settlementPriceCents: SETTLEMENT_PRICE_CENTS,
  });

  const settleTx = await program.methods
    .adminSettle(true, new BN(SETTLEMENT_PRICE_CENTS))
    .accountsStrict({
      admin: admin.publicKey,
      config: configPda,
      strikeMarket: strikeMarketPda,
    })
    .signers([admin])
    .rpc();

  log('7-settle', 'Market settled', { signature: settleTx });

  // Verify settlement
  const marketAccount = await program.account['strikeMarket'].fetch(strikeMarketPda);
  log('7-settle', 'Market state', {
    settled: marketAccount.settled,
    outcomeYesWins: marketAccount.outcomeYesWins,
    settlementPrice: marketAccount.settlementPrice.toString(),
    settledAt: marketAccount.settledAt.toString(),
  });

  // ------------------------------------------------------------------
  // Step 8: Redeem YES tokens (winning side)
  // ------------------------------------------------------------------
  log('8-redeem', 'Redeeming YES tokens');

  const redeemTx = await program.methods
    .redeem(new BN(PAIRS_TO_MINT), true)  // redeem_yes = true
    .accountsStrict({
      user: admin.publicKey,
      strikeMarket: strikeMarketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      userYes: adminYesAta.address,
      userNo: adminNoAta.address,
      userUsdc: adminTestAta.address,
      vault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([admin])
    .rpc();

  log('8-redeem', 'YES tokens redeemed', { signature: redeemTx });

  // Final balances
  const finalYes = await connection.getTokenAccountBalance(adminYesAta.address);
  const finalNo = await connection.getTokenAccountBalance(adminNoAta.address);
  const finalUsdc = await connection.getTokenAccountBalance(adminTestAta.address);
  const finalVault = await connection.getTokenAccountBalance(vaultPda);

  log('8-redeem', 'Final balances', {
    yes: finalYes.value.uiAmountString,
    no: finalNo.value.uiAmountString,
    usdc: finalUsdc.value.uiAmountString,
    vault: finalVault.value.uiAmountString,
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const balanceAfter = await connection.getBalance(admin.publicKey);
  const solUsed = (balanceBefore - balanceAfter) / 1e9;

  log('done', '=== Lifecycle Test Complete ===', {
    solUsed: solUsed.toFixed(6),
    stepsCompleted: [
      'create_test_mint',
      'mint_test_tokens',
      'create_strike_market',
      'create_atas',
      'mint_pair',
      'admin_settle',
      'redeem_yes',
    ],
    result: 'SUCCESS - Full lifecycle verified on devnet',
  });
}

main().catch((err) => {
  console.error('Lifecycle test failed:', err);
  process.exit(1);
});
