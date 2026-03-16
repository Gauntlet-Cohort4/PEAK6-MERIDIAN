/**
 * Creates a fresh unsettled strike market with a placeholder Phoenix address
 * and a test USDC mint we control. Used to test Phoenix market creation.
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
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';

const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const ADMIN_PATH = process.env['ADMIN_KEYPAIR_PATH'] ?? '~/.config/solana/id.json';

async function main(): Promise<void> {
  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair(ADMIN_PATH);
  const wallet = new Wallet(admin);
  const provider = createProvider(connection, wallet);
  const program = createProgram(provider);

  log('start', 'Creating test market for Phoenix integration');

  // Create test USDC mint
  const testMint = await createMint(connection, admin, admin.publicKey, null, 6);
  log('mint', 'Test USDC mint created', { mint: testMint.toBase58() });

  // Fund admin with test USDC
  const adminAta = await getOrCreateAssociatedTokenAccount(connection, admin, testMint, admin.publicKey);
  await mintTo(connection, admin, testMint, adminAta.address, admin, 100_000_000);
  log('mint', 'Minted 100 test-USDC to admin');

  // Create strike market
  const tradingDate = new BN(Math.floor(Date.now() / 1000) + 10);
  const strikePrice = new BN(23000); // $230.00
  const ticker = 'AAPL';

  const [configPda] = deriveConfigPda();
  const [tickerPda] = deriveTickerPda(ticker);
  const [strikeMarketPda] = deriveStrikeMarketPda(ticker, strikePrice, tradingDate);
  const [yesMintPda] = deriveYesMintPda(strikeMarketPda);
  const [noMintPda] = deriveNoMintPda(strikeMarketPda);
  const [vaultPda] = deriveVaultPda(strikeMarketPda);

  const tx = await program.methods
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
      phoenixMarket: PublicKey.default,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
    })
    .signers([admin])
    .rpc();

  log('done', 'Strike market created', {
    strikeMarket: strikeMarketPda.toBase58(),
    yesMint: yesMintPda.toBase58(),
    noMint: noMintPda.toBase58(),
    testUsdcMint: testMint.toBase58(),
    signature: tx,
  });
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
