/**
 * @module scripts/devnet-dashboard
 * Standalone CLI dashboard that queries Solana devnet and displays
 * the on-chain state of the Meridian prediction-market program.
 *
 * Usage:
 *   npx tsx scripts/devnet-dashboard.ts
 *   npx tsx scripts/devnet-dashboard.ts <WALLET_ADDRESS>
 */

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import {
  PROGRAM_ID,
  SEEDS,
  deriveConfigPda,
  DEVNET_USDC_MINT,
} from './helpers';
import * as fs from 'fs';
import * as path from 'path';

// ── ANSI helpers ──────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';
const BG_YELLOW = '\x1b[43m';
const BG_CYAN = '\x1b[46m';

function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

function badge(text: string, bg: string): string {
  return `${bg}${BOLD} ${text} ${RESET}`;
}

// ── IDL loading ───────────────────────────────────────────────────────

const IDL_PATH = path.resolve(__dirname, 'idl', 'meridian.json');

function loadIdl(): Record<string, unknown> {
  const raw = fs.readFileSync(IDL_PATH, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

// ── Constants ─────────────────────────────────────────────────────────

const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const USDC_DECIMALS = 6;
const OUTCOME_DECIMALS = 6;
const MIN_STRIKE_CENTS = 10000; // Filter out broken markets below $100 (old dollar-encoded strikes)

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// ── Types ─────────────────────────────────────────────────────────────

interface MarketRow {
  readonly address: string;
  readonly ticker: string;
  readonly strikePrice: number;
  readonly strikeCents: number;
  readonly tradingDate: number;
  readonly tradingDateStr: string;
  readonly status: string;
  readonly settled: boolean;
  readonly outcomeYesWins: boolean;
  readonly settlementPrice: number;
  readonly totalPairsMinted: number;
  readonly totalPairsRedeemed: number;
  readonly vaultBalance: number;
  readonly yesMint: PublicKey;
  readonly noMint: PublicKey;
}

interface ConfigData {
  readonly admin: string;
  readonly paused: boolean;
  readonly stalenessThreshold: number;
  readonly confidenceThresholdBps: number;
}

// ── Status derivation ─────────────────────────────────────────────────

function deriveStatus(settled: boolean, tradingDateSec: number): string {
  if (settled) return 'SETTLED';
  const tradingDateMs = tradingDateSec * 1000;
  const closingMs = tradingDateMs + 16 * 3600 * 1000;
  const openingMs = tradingDateMs + 9.5 * 3600 * 1000;
  const now = Date.now();
  if (now >= closingMs) return 'CLOSED';
  if (now < openingMs) return 'PENDING';
  return 'OPEN';
}

function statusBadge(status: string): string {
  switch (status) {
    case 'OPEN':
      return badge('OPEN', BG_GREEN);
    case 'PENDING':
      return badge('PENDING', BG_CYAN);
    case 'CLOSED':
      return badge('CLOSED', BG_YELLOW);
    case 'SETTLED':
      return badge('SETTLED', BG_RED);
    default:
      return status;
  }
}

// ── ATA derivation ────────────────────────────────────────────────────

function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

// ── Formatting helpers ────────────────────────────────────────────────

function truncAddr(addr: string, len: number = 4): string {
  return `${addr.slice(0, len)}..${addr.slice(-len)}`;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtTokens(raw: number, decimals: number): string {
  return (raw / Math.pow(10, decimals)).toFixed(decimals > 2 ? 2 : decimals);
}

function fmtDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function padRight(str: string, len: number): string {
  // Strip ANSI for length calc
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const padLen = Math.max(0, len - stripped.length);
  return str + ' '.repeat(padLen);
}

function padLeft(str: string, len: number): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const padLen = Math.max(0, len - stripped.length);
  return ' '.repeat(padLen) + str;
}

// ── Table drawing ─────────────────────────────────────────────────────

function drawLine(widths: readonly number[], char: string = '-'): string {
  return '+' + widths.map(w => char.repeat(w + 2)).join('+') + '+';
}

function drawRow(cells: readonly string[], widths: readonly number[]): string {
  return '| ' + cells.map((c, i) => padRight(c, widths[i]!)).join(' | ') + ' |';
}

function drawRowRight(cells: readonly string[], widths: readonly number[], rightAlignCols: readonly number[]): string {
  return '| ' + cells.map((c, i) => {
    if (rightAlignCols.includes(i)) {
      return padLeft(c, widths[i]!);
    }
    return padRight(c, widths[i]!);
  }).join(' | ') + ' |';
}

// ── Program setup ─────────────────────────────────────────────────────

function createReadOnlyProgram(connection: Connection): Program {
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx: never) => tx,
      signAllTransactions: async (txs: never) => txs,
    } as never,
    { commitment: 'confirmed' },
  );
  const idl = loadIdl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(idl as any, provider);
}

// ── Data fetching ─────────────────────────────────────────────────────

async function fetchConfig(program: Program): Promise<ConfigData | null> {
  try {
    const [configPda] = deriveConfigPda();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = await (program.account as any).meridianConfig.fetch(configPda);
    return {
      admin: (account.admin as PublicKey).toBase58(),
      paused: account.paused as boolean,
      stalenessThreshold: (account.stalenessThreshold as BN).toNumber(),
      confidenceThresholdBps: (account.confidenceThresholdBps as BN).toNumber(),
    };
  } catch {
    return null;
  }
}

async function fetchAllMarkets(program: Program): Promise<readonly MarketRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAccounts = await (program.account as any).strikeMarket.all();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawAccounts.map((item: { publicKey: PublicKey; account: any }) => {
    const acct = item.account;
    const strikeCents = (acct.strikePrice as BN).toNumber();
    const tradingDateSec = (acct.tradingDate as BN).toNumber();
    const settled = acct.settled as boolean;

    const row: MarketRow = {
      address: item.publicKey.toBase58(),
      ticker: acct.ticker as string,
      strikeCents,
      strikePrice: strikeCents / 100,
      tradingDate: tradingDateSec,
      tradingDateStr: fmtDate(tradingDateSec),
      status: deriveStatus(settled, tradingDateSec),
      settled,
      outcomeYesWins: acct.outcomeYesWins as boolean,
      settlementPrice: (acct.settlementPrice as BN).toNumber(),
      totalPairsMinted: (acct.totalPairsMinted as BN).toNumber(),
      totalPairsRedeemed: (acct.totalPairsRedeemed as BN).toNumber(),
      vaultBalance: 0, // filled later if possible
      yesMint: acct.yesMint as PublicKey,
      noMint: acct.noMint as PublicKey,
    };
    return row;
  });
}

async function fetchVaultBalance(
  connection: Connection,
  marketAddress: PublicKey,
): Promise<number> {
  try {
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [SEEDS.VAULT, marketAddress.toBuffer()],
      PROGRAM_ID,
    );
    const resp = await connection.getTokenAccountBalance(vaultPda);
    return resp.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

async function fetchTokenBalance(
  connection: Connection,
  ataAddress: PublicKey,
): Promise<number> {
  try {
    const resp = await connection.getTokenAccountBalance(ataAddress);
    return resp.value.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

async function fetchSolBalance(connection: Connection, wallet: PublicKey): Promise<number> {
  try {
    const lamports = await connection.getBalance(wallet);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

// ── Section renderers ─────────────────────────────────────────────────

function renderHeader(): void {
  console.log('');
  console.log(colorize('='.repeat(80), DIM));
  console.log(colorize('  MERIDIAN DEVNET DASHBOARD', `${BOLD}${CYAN}`));
  console.log(colorize(`  ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`, DIM));
  console.log(colorize('='.repeat(80), DIM));
  console.log('');
}

function renderProgramOverview(config: ConfigData | null, totalMarkets: number): void {
  console.log(colorize('  PROGRAM OVERVIEW', `${BOLD}${WHITE}`));
  console.log(colorize('  ' + '-'.repeat(40), DIM));
  console.log(`  Program ID:    ${colorize(PROGRAM_ID.toBase58(), CYAN)}`);
  console.log(`  Network:       ${colorize('devnet', YELLOW)}`);
  console.log(`  RPC:           ${colorize(RPC_URL, DIM)}`);
  console.log('');

  if (config) {
    const pauseLabel = config.paused
      ? badge('PAUSED', BG_RED)
      : badge('ACTIVE', BG_GREEN);
    console.log(`  Config PDA:    ${pauseLabel}`);
    console.log(`  Admin:         ${colorize(truncAddr(config.admin, 6), DIM)}`);
    console.log(`  Staleness:     ${config.stalenessThreshold}s`);
    console.log(`  Confidence:    ${config.confidenceThresholdBps} bps`);
  } else {
    console.log(colorize('  Config PDA:    NOT FOUND (program may not be initialized)', RED));
  }

  console.log(`  Total Markets: ${colorize(String(totalMarkets), BOLD)}`);
  console.log('');
}

function renderMarketsTable(markets: readonly MarketRow[]): void {
  if (markets.length === 0) {
    console.log(colorize('  No markets found on-chain.', DIM));
    console.log('');
    return;
  }

  // Group by ticker
  const grouped = new Map<string, MarketRow[]>();
  for (const m of markets) {
    const existing = grouped.get(m.ticker);
    if (existing) {
      existing.push(m);
    } else {
      grouped.set(m.ticker, [m]);
    }
  }

  console.log(colorize('  MARKETS SUMMARY', `${BOLD}${WHITE}`));
  console.log(colorize('  ' + '-'.repeat(40), DIM));
  console.log('');

  const headers = ['Address', 'Strike', 'Date', 'Status', 'Outcome', 'Minted', 'Redeemed', 'Vault'];
  const widths = [12, 10, 14, 12, 8, 8, 8, 12];

  for (const [ticker, tickerMarkets] of grouped) {
    // Sort by trading date, then strike
    const sorted = [...tickerMarkets].sort((a, b) => {
      const dateDiff = a.tradingDate - b.tradingDate;
      return dateDiff !== 0 ? dateDiff : a.strikeCents - b.strikeCents;
    });

    console.log(`  ${colorize(ticker, `${BOLD}${CYAN}`)} (${sorted.length} market${sorted.length > 1 ? 's' : ''})`);
    console.log('  ' + drawLine(widths));
    console.log('  ' + drawRow(headers, widths));
    console.log('  ' + drawLine(widths));

    for (const m of sorted) {
      const outcomeStr = m.settled
        ? (m.outcomeYesWins ? colorize('YES', GREEN) : colorize('NO', RED))
        : colorize('--', DIM);

      const vaultStr = m.vaultBalance > 0
        ? `${m.vaultBalance.toFixed(2)} USDC`
        : colorize('--', DIM);

      const row = [
        truncAddr(m.address),
        fmtUsd(m.strikeCents),
        m.tradingDateStr,
        m.status,
        m.settled ? (m.outcomeYesWins ? 'YES' : 'NO') : '--',
        fmtTokens(m.totalPairsMinted, OUTCOME_DECIMALS),
        fmtTokens(m.totalPairsRedeemed, OUTCOME_DECIMALS),
        m.vaultBalance > 0 ? m.vaultBalance.toFixed(2) : '--',
      ];
      console.log('  ' + drawRow(row, widths));
    }

    console.log('  ' + drawLine(widths));
    console.log('');
  }
}

function renderSettlementStatus(markets: readonly MarketRow[]): void {
  console.log(colorize('  SETTLEMENT STATUS', `${BOLD}${WHITE}`));
  console.log(colorize('  ' + '-'.repeat(40), DIM));

  const settled = markets.filter(m => m.status === 'SETTLED');
  const closed = markets.filter(m => m.status === 'CLOSED');
  const open = markets.filter(m => m.status === 'OPEN');
  const pending = markets.filter(m => m.status === 'PENDING');

  console.log(`  Settled:  ${colorize(String(settled.length), GREEN)}`);
  console.log(`  Closed:   ${colorize(String(closed.length), YELLOW)} (awaiting settlement)`);
  console.log(`  Open:     ${colorize(String(open.length), CYAN)}`);
  console.log(`  Pending:  ${colorize(String(pending.length), DIM)}`);

  // Find overdue markets (past trading date + 16h but not settled)
  const now = Date.now();
  const overdue = markets.filter(m => {
    if (m.settled) return false;
    const closingMs = m.tradingDate * 1000 + 16 * 3600 * 1000;
    return now >= closingMs;
  });

  if (overdue.length > 0) {
    console.log('');
    console.log(`  ${colorize('OVERDUE', `${BOLD}${RED}`)} (past close, not settled): ${overdue.length}`);
    for (const m of overdue) {
      const hoursOverdue = ((now - (m.tradingDate * 1000 + 16 * 3600 * 1000)) / 3600000).toFixed(1);
      console.log(`    ${truncAddr(m.address)} | ${m.ticker} ${fmtUsd(m.strikeCents)} | ${hoursOverdue}h overdue`);
    }
  }

  console.log('');
}

async function renderWalletPositions(
  connection: Connection,
  walletAddr: string,
  markets: readonly MarketRow[],
): Promise<void> {
  console.log(colorize('  WALLET POSITIONS', `${BOLD}${WHITE}`));
  console.log(colorize('  ' + '-'.repeat(40), DIM));

  const wallet = new PublicKey(walletAddr);
  console.log(`  Wallet:  ${colorize(walletAddr, CYAN)}`);
  console.log('');

  // Fetch SOL and USDC balances in parallel
  const usdcAta = deriveAta(wallet, DEVNET_USDC_MINT);
  const [solBal, usdcBal] = await Promise.all([
    fetchSolBalance(connection, wallet),
    fetchTokenBalance(connection, usdcAta),
  ]);

  console.log(`  SOL:     ${colorize(solBal.toFixed(4), BOLD)} SOL`);
  console.log(`  USDC:    ${colorize(usdcBal.toFixed(2), BOLD)} USDC`);
  console.log('');

  if (markets.length === 0) {
    console.log(colorize('  No markets to check positions against.', DIM));
    console.log('');
    return;
  }

  // Scan all markets for YES/NO token balances using getTokenAccountsByOwner
  // This is more efficient than deriving ATAs one by one
  let tokenAccounts: Map<string, number>;
  try {
    const resp = await connection.getTokenAccountsByOwner(wallet, {
      programId: TOKEN_PROGRAM_ID,
    });

    tokenAccounts = new Map();
    for (const item of resp.value) {
      // Parse the token account data to get mint and amount
      // SPL Token account layout: mint (32 bytes), owner (32 bytes), amount (8 bytes LE)
      const data = item.account.data;
      const mintBytes = data.slice(0, 32);
      const mint = new PublicKey(mintBytes).toBase58();
      const amountBytes = data.slice(64, 72);
      const amount = Number(
        amountBytes[0]! +
        amountBytes[1]! * 256 +
        amountBytes[2]! * 65536 +
        amountBytes[3]! * 16777216 +
        amountBytes[4]! * 4294967296 +
        amountBytes[5]! * 1099511627776 +
        amountBytes[6]! * 281474976710656 +
        amountBytes[7]! * 72057594037927936,
      );
      tokenAccounts.set(mint, amount);
    }
  } catch {
    console.log(colorize('  Failed to fetch token accounts.', RED));
    console.log('');
    return;
  }

  // Match against market mints
  const positions: Array<{
    readonly market: MarketRow;
    readonly yesBalance: number;
    readonly noBalance: number;
  }> = [];

  for (const market of markets) {
    const yesBal = tokenAccounts.get(market.yesMint.toBase58()) ?? 0;
    const noBal = tokenAccounts.get(market.noMint.toBase58()) ?? 0;
    if (yesBal > 0 || noBal > 0) {
      positions.push({ market, yesBalance: yesBal, noBalance: noBal });
    }
  }

  if (positions.length === 0) {
    console.log(colorize('  No token positions found for this wallet.', DIM));
    console.log('');
    return;
  }

  const headers = ['Market', 'Ticker', 'Strike', 'YES Bal', 'NO Bal', 'Status', 'P&L'];
  const widths = [12, 6, 10, 10, 10, 10, 12];

  console.log(`  Positions: ${colorize(String(positions.length), BOLD)} market${positions.length > 1 ? 's' : ''}`);
  console.log('  ' + drawLine(widths));
  console.log('  ' + drawRow(headers, widths));
  console.log('  ' + drawLine(widths));

  for (const pos of positions) {
    const m = pos.market;
    const yesDisp = fmtTokens(pos.yesBalance, OUTCOME_DECIMALS);
    const noDisp = fmtTokens(pos.noBalance, OUTCOME_DECIMALS);

    // P&L calculation for settled markets
    let pnlStr = '--';
    if (m.settled) {
      const yesTokens = pos.yesBalance / Math.pow(10, OUTCOME_DECIMALS);
      const noTokens = pos.noBalance / Math.pow(10, OUTCOME_DECIMALS);
      // Winner gets $1 per token, loser gets $0
      // Cost basis was $1 per pair (YES+NO together)
      const payout = m.outcomeYesWins ? yesTokens : noTokens;
      // We can't know cost basis without trade history, so show payout value
      pnlStr = `$${payout.toFixed(2)}`;
    }

    const row = [
      truncAddr(m.address),
      m.ticker,
      fmtUsd(m.strikeCents),
      yesDisp,
      noDisp,
      m.status,
      pnlStr,
    ];
    console.log('  ' + drawRow(row, widths));
  }

  console.log('  ' + drawLine(widths));
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const walletArg = process.argv[2] ?? null;

  const connection = new Connection(RPC_URL, 'confirmed');
  const program = createReadOnlyProgram(connection);

  renderHeader();

  // Fetch config and markets in parallel
  const [config, allMarkets] = await Promise.all([
    fetchConfig(program),
    fetchAllMarkets(program),
  ]);

  // Filter out broken markets (strike < $5)
  const markets = allMarkets.filter(m => m.strikeCents >= MIN_STRIKE_CENTS);
  const filteredCount = allMarkets.length - markets.length;

  renderProgramOverview(config, markets.length);

  if (filteredCount > 0) {
    console.log(colorize(`  (${filteredCount} broken market${filteredCount > 1 ? 's' : ''} filtered out with strike < $5)`, DIM));
    console.log('');
  }

  // Fetch vault balances in parallel (batch in groups to avoid rate limits)
  const BATCH_SIZE = 10;
  const marketsWithVaults: MarketRow[] = [...markets];
  for (let i = 0; i < marketsWithVaults.length; i += BATCH_SIZE) {
    const batch = marketsWithVaults.slice(i, i + BATCH_SIZE);
    const balances = await Promise.all(
      batch.map(m => fetchVaultBalance(connection, new PublicKey(m.address))),
    );
    for (let j = 0; j < batch.length; j++) {
      // Create a new object with vault balance (immutable pattern)
      marketsWithVaults[i + j] = { ...batch[j]!, vaultBalance: balances[j]! };
    }
  }

  renderMarketsTable(marketsWithVaults);
  renderSettlementStatus(marketsWithVaults);

  if (walletArg) {
    try {
      // Validate the wallet address
      new PublicKey(walletArg);
      await renderWalletPositions(connection, walletArg, marketsWithVaults);
    } catch (err) {
      console.log(colorize(`  Invalid wallet address: ${walletArg}`, RED));
      if (err instanceof Error) {
        console.log(colorize(`  ${err.message}`, DIM));
      }
      console.log('');
    }
  }

  console.log(colorize('='.repeat(80), DIM));
  console.log('');
}

main().catch((err) => {
  console.error(colorize('Fatal error:', RED), err);
  process.exit(1);
});
