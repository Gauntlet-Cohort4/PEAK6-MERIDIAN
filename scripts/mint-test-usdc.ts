/**
 * Mint test USDC to a recipient wallet on devnet.
 * Creates a new USDC mint if needed, or uses existing one.
 *
 * Usage:
 *   npx tsx scripts/mint-test-usdc.ts <RECIPIENT_ADDRESS> <AMOUNT>
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const MINT_RECORD_PATH = path.join(__dirname, '.test-usdc-mint.json');

function loadKeypair(keypairPath: string): Keypair {
  const resolved = keypairPath.replace(/^~/, os.homedir());
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const recipientAddress = process.argv[2];
  const amount = parseInt(process.argv[3] || '10000', 10);

  if (!recipientAddress) {
    console.error('Usage: npx tsx scripts/mint-test-usdc.ts <RECIPIENT_ADDRESS> [AMOUNT]');
    process.exit(1);
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const adminPath = process.env['ADMIN_KEYPAIR_PATH'] || '~/.config/solana/id.json';
  const admin = loadKeypair(adminPath);
  const recipient = new PublicKey(recipientAddress);
  const decimals = 6;

  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Recipient: ${recipient.toBase58()}`);
  console.log(`Amount: ${amount} USDC`);

  // Check if we already have a test USDC mint
  let usdcMint: PublicKey;

  if (fs.existsSync(MINT_RECORD_PATH)) {
    const record = JSON.parse(fs.readFileSync(MINT_RECORD_PATH, 'utf-8'));
    usdcMint = new PublicKey(record.mint);
    console.log(`Using existing test USDC mint: ${usdcMint.toBase58()}`);
  } else {
    console.log('Creating new test USDC mint...');
    usdcMint = await createMint(connection, admin, admin.publicKey, null, decimals);
    fs.writeFileSync(MINT_RECORD_PATH, JSON.stringify({ mint: usdcMint.toBase58() }, null, 2));
    console.log(`Created test USDC mint: ${usdcMint.toBase58()}`);
    console.log(`\n** UPDATE your .env and .env.example: **`);
    console.log(`   NEXT_PUBLIC_USDC_MINT=${usdcMint.toBase58()}`);
  }

  // Create or get recipient's ATA
  console.log('Creating/getting recipient token account...');
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin, // payer
    usdcMint,
    recipient,
  );
  console.log(`Recipient ATA: ${recipientAta.address.toBase58()}`);

  // Mint tokens
  const mintAmount = amount * (10 ** decimals);
  console.log(`Minting ${amount} USDC (${mintAmount} raw units)...`);
  const sig = await mintTo(
    connection,
    admin,
    usdcMint,
    recipientAta.address,
    admin,
    mintAmount,
  );
  console.log(`Minted! Signature: ${sig}`);
  console.log(`\nRecipient now has ${amount} test USDC at ${recipientAta.address.toBase58()}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
