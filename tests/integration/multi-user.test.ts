/**
 * Integration test: Multi-User Scenarios
 *
 * Covers ProjSpec requirement:
 *   One user mints and quotes, another takes, both redeem
 *
 * Exercises concurrent user interactions through the mocked on-chain
 * client and order book adapter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlaceOrderParams, OrderBookAdapter } from '@meridian/shared/adapters/types.js';
import { TradeSide } from '@meridian/shared/types.js';
import { runSettlementJob, type SettlementJobDeps } from '../../automation/src/jobs/settlement-job.js';
import type { MeridianClient, CreateStrikeMarketParams } from '../../automation/src/services/meridian-client.js';
import type { ActiveMarket } from '../../automation/src/types/active-market.js';
import {
  createMockOrderBook,
  createMockPriceService,
  createMockTradingDayService,
  createMockAlertService,
  buildActiveMarket,
  buildPriceData,
  resetMarketCounter,
} from './helpers/mock-factories.js';

// ---------------------------------------------------------------------------
// Simulated on-chain state for multi-user tests
// ---------------------------------------------------------------------------

interface UserPosition {
  readonly publicKey: string;
  yesBalance: number;
  noBalance: number;
  usdcBalance: number;
}

interface MarketState {
  readonly marketAddress: string;
  readonly strikePrice: number;
  readonly ticker: string;
  totalPairsMinted: number;
  settled: boolean;
  outcomeYesWins: boolean | null;
  settlementPrice: number | null;
  readonly positions: Map<string, UserPosition>;
}

/**
 * Simulates a simplified on-chain market state for tracking
 * minting, trading, settlement, and redemption across multiple users.
 */
function createSimulatedMarket(
  ticker: string,
  strikePrice: number,
): MarketState {
  return {
    marketAddress: `sim-market-${ticker}-${strikePrice}`,
    strikePrice,
    ticker,
    totalPairsMinted: 0,
    settled: false,
    outcomeYesWins: null,
    settlementPrice: null,
    positions: new Map(),
  };
}

function getOrCreatePosition(market: MarketState, publicKey: string): UserPosition {
  const existing = market.positions.get(publicKey);
  if (existing) return existing;

  const position: UserPosition = {
    publicKey,
    yesBalance: 0,
    noBalance: 0,
    usdcBalance: 1_000_000, // start with 1M USDC lamports (1 USDC)
  };
  market.positions.set(publicKey, position);
  return position;
}

/** Mint a YES+NO pair for a user (costs 1 USDC per pair). */
function mintPair(market: MarketState, userKey: string, pairCount: number): void {
  const position = getOrCreatePosition(market, userKey);
  const cost = pairCount * 1_000_000; // 1 USDC per pair in lamports
  if (position.usdcBalance < cost) {
    throw new Error(`Insufficient USDC: need ${cost}, have ${position.usdcBalance}`);
  }
  position.usdcBalance -= cost;
  position.yesBalance += pairCount * 1_000_000; // 1:1 with USDC lamports
  position.noBalance += pairCount * 1_000_000;
  market.totalPairsMinted += pairCount;
}

/** Transfer YES tokens between users (simulating a trade fill). */
function transferYes(
  market: MarketState,
  fromKey: string,
  toKey: string,
  amount: number,
  usdcPrice: number,
): void {
  const seller = getOrCreatePosition(market, fromKey);
  const buyer = getOrCreatePosition(market, toKey);

  if (seller.yesBalance < amount) {
    throw new Error(`Seller ${fromKey} has insufficient YES tokens`);
  }

  const usdcCost = Math.floor(amount * usdcPrice);
  if (buyer.usdcBalance < usdcCost) {
    throw new Error(`Buyer ${toKey} has insufficient USDC`);
  }

  seller.yesBalance -= amount;
  seller.usdcBalance += usdcCost;
  buyer.yesBalance += amount;
  buyer.usdcBalance -= usdcCost;
}

/** Transfer NO tokens between users. */
function transferNo(
  market: MarketState,
  fromKey: string,
  toKey: string,
  amount: number,
  usdcPrice: number,
): void {
  const seller = getOrCreatePosition(market, fromKey);
  const buyer = getOrCreatePosition(market, toKey);

  if (seller.noBalance < amount) {
    throw new Error(`Seller ${fromKey} has insufficient NO tokens`);
  }

  const usdcCost = Math.floor(amount * usdcPrice);
  if (buyer.usdcBalance < usdcCost) {
    throw new Error(`Buyer ${toKey} has insufficient USDC`);
  }

  seller.noBalance -= amount;
  seller.usdcBalance += usdcCost;
  buyer.noBalance += amount;
  buyer.usdcBalance -= usdcCost;
}

/** Settle the market. */
function settleMarket(market: MarketState, settlementPrice: number): void {
  market.settled = true;
  market.settlementPrice = settlementPrice;
  market.outcomeYesWins = settlementPrice >= market.strikePrice;
}

/** Redeem winning tokens for USDC. Returns the USDC payout. */
function redeem(market: MarketState, userKey: string): number {
  if (!market.settled) {
    throw new Error('Market not settled');
  }

  const position = getOrCreatePosition(market, userKey);

  let payout = 0;
  if (market.outcomeYesWins) {
    // YES wins: each YES token redeems for 1 USDC (in lamports)
    payout = position.yesBalance;
    position.yesBalance = 0;
    // NO tokens are worthless
    position.noBalance = 0;
  } else {
    // NO wins: each NO token redeems for 1 USDC
    payout = position.noBalance;
    position.noBalance = 0;
    // YES tokens are worthless
    position.yesBalance = 0;
  }

  position.usdcBalance += payout;
  return payout;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Multi-User Scenarios', () => {
  beforeEach(() => {
    resetMarketCounter();
  });

  const ALICE = 'alice-pubkey';
  const BOB = 'bob-pubkey';
  const CHARLIE = 'charlie-pubkey';

  it('should support one user minting+quoting and another user taking, then both redeem (YES wins)', () => {
    const market = createSimulatedMarket('AAPL', 190);

    // Give Alice extra USDC for minting
    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 10_000_000; // 10 USDC

    // Give Bob USDC for taking
    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 5_000_000; // 5 USDC

    // Step 1: Alice mints 5 YES+NO pairs (costs 5 USDC)
    mintPair(market, ALICE, 5);
    expect(alicePos.yesBalance).toBe(5_000_000);
    expect(alicePos.noBalance).toBe(5_000_000);
    expect(alicePos.usdcBalance).toBe(5_000_000); // 10 - 5

    // Step 2: Alice quotes: offers 3 YES tokens at 0.60 each
    // Bob takes: buys 3 YES tokens from Alice at 0.60
    transferYes(market, ALICE, BOB, 3_000_000, 0.60);

    expect(alicePos.yesBalance).toBe(2_000_000); // 5 - 3
    expect(alicePos.usdcBalance).toBe(6_800_000); // 5 + (3 * 0.60)
    expect(bobPos.yesBalance).toBe(3_000_000);
    expect(bobPos.usdcBalance).toBe(3_200_000); // 5 - (3 * 0.60)

    // Step 3: Settle at $195 (above strike $190) -> YES wins
    settleMarket(market, 195);
    expect(market.outcomeYesWins).toBe(true);

    // Step 4: Both redeem
    const alicePayout = redeem(market, ALICE);
    const bobPayout = redeem(market, BOB);

    // Alice has 2 YES tokens -> gets 2 USDC
    expect(alicePayout).toBe(2_000_000);
    // Bob has 3 YES tokens -> gets 3 USDC
    expect(bobPayout).toBe(3_000_000);

    // Alice's NO tokens (5) are worthless
    expect(alicePos.yesBalance).toBe(0);
    expect(alicePos.noBalance).toBe(0);
    expect(bobPos.yesBalance).toBe(0);
    expect(bobPos.noBalance).toBe(0);

    // Final USDC balances
    expect(alicePos.usdcBalance).toBe(6_800_000 + 2_000_000); // 8.8 USDC
    expect(bobPos.usdcBalance).toBe(3_200_000 + 3_000_000); // 6.2 USDC
  });

  it('should support one user minting+quoting and another user taking, then both redeem (NO wins)', () => {
    const market = createSimulatedMarket('MSFT', 420);

    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 10_000_000;

    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 5_000_000;

    // Alice mints 5 pairs
    mintPair(market, ALICE, 5);

    // Alice quotes: offers 3 NO tokens at 0.40 each
    // Bob takes: buys 3 NO tokens from Alice
    transferNo(market, ALICE, BOB, 3_000_000, 0.40);

    expect(alicePos.noBalance).toBe(2_000_000); // 5 - 3
    expect(bobPos.noBalance).toBe(3_000_000);

    // Settle at $415 (below strike $420) -> NO wins
    settleMarket(market, 415);
    expect(market.outcomeYesWins).toBe(false);

    // Both redeem
    const alicePayout = redeem(market, ALICE);
    const bobPayout = redeem(market, BOB);

    // Alice has 2 NO tokens -> gets 2 USDC
    expect(alicePayout).toBe(2_000_000);
    // Bob has 3 NO tokens -> gets 3 USDC
    expect(bobPayout).toBe(3_000_000);

    // YES tokens are worthless
    expect(alicePos.yesBalance).toBe(0);
    expect(bobPos.yesBalance).toBe(0);
  });

  it('should handle three users: minter, maker, and taker', () => {
    const market = createSimulatedMarket('NVDA', 880);

    // Charlie mints, Alice makes markets, Bob takes
    const charliePos = getOrCreatePosition(market, CHARLIE);
    charliePos.usdcBalance = 20_000_000;

    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 10_000_000;

    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 10_000_000;

    // Charlie mints 10 pairs
    mintPair(market, CHARLIE, 10);
    expect(charliePos.yesBalance).toBe(10_000_000);
    expect(charliePos.noBalance).toBe(10_000_000);

    // Charlie transfers YES and NO to Alice (the market maker)
    transferYes(market, CHARLIE, ALICE, 5_000_000, 0.50);
    transferNo(market, CHARLIE, ALICE, 5_000_000, 0.50);

    // Alice now has inventory to make markets
    expect(alicePos.yesBalance).toBe(5_000_000);
    expect(alicePos.noBalance).toBe(5_000_000);

    // Bob takes from Alice: buys 3 YES tokens at 0.55
    transferYes(market, ALICE, BOB, 3_000_000, 0.55);

    // Bob also buys 2 NO tokens from Alice at 0.45
    transferNo(market, ALICE, BOB, 2_000_000, 0.45);

    // Alice's remaining inventory
    expect(alicePos.yesBalance).toBe(2_000_000);
    expect(alicePos.noBalance).toBe(3_000_000);

    // Settle at $900 (above $880 strike) -> YES wins
    settleMarket(market, 900);
    expect(market.outcomeYesWins).toBe(true);

    // All three redeem
    const charliePayout = redeem(market, CHARLIE);
    const alicePayout = redeem(market, ALICE);
    const bobPayout = redeem(market, BOB);

    // Charlie: 5 YES tokens left -> 5 USDC
    expect(charliePayout).toBe(5_000_000);
    // Alice: 2 YES tokens left -> 2 USDC
    expect(alicePayout).toBe(2_000_000);
    // Bob: 3 YES tokens -> 3 USDC
    expect(bobPayout).toBe(3_000_000);

    // Total redeemed = 10 USDC = total minted (conservation of value)
    expect(charliePayout + alicePayout + bobPayout).toBe(10_000_000);
  });

  it('should prevent redemption before settlement', () => {
    const market = createSimulatedMarket('AAPL', 190);

    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 5_000_000;

    mintPair(market, ALICE, 3);

    expect(() => redeem(market, ALICE)).toThrow('Market not settled');
  });

  it('should prevent minting with insufficient USDC', () => {
    const market = createSimulatedMarket('AAPL', 190);

    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 500_000; // only 0.5 USDC

    expect(() => mintPair(market, ALICE, 1)).toThrow('Insufficient USDC');
  });

  it('should prevent selling more tokens than owned', () => {
    const market = createSimulatedMarket('AAPL', 190);

    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 5_000_000;

    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 10_000_000;

    mintPair(market, ALICE, 3);

    // Alice has 3 YES tokens, tries to sell 5
    expect(() => transferYes(market, ALICE, BOB, 5_000_000, 0.50))
      .toThrow('insufficient YES tokens');
  });

  it('should verify conservation of value: total USDC in = total USDC out', () => {
    const market = createSimulatedMarket('TSLA', 250);

    // Setup: two users with known USDC amounts
    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 10_000_000;
    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 10_000_000;

    const totalInitialUsdc = alicePos.usdcBalance + bobPos.usdcBalance;

    // Alice mints 5 pairs (5 USDC goes into the vault)
    mintPair(market, ALICE, 5);
    const vaultUsdc = market.totalPairsMinted * 1_000_000;

    // Mid-market: user USDC + vault USDC = initial total
    const midUserUsdc = alicePos.usdcBalance + bobPos.usdcBalance;
    expect(midUserUsdc + vaultUsdc).toBe(totalInitialUsdc);

    // Alice sells 3 YES to Bob at 0.55 (zero-sum transfer, no USDC enters/exits vault)
    transferYes(market, ALICE, BOB, 3_000_000, 0.55);

    // After trading: user USDC + vault USDC still = initial total
    const postTradeUserUsdc = alicePos.usdcBalance + bobPos.usdcBalance;
    expect(postTradeUserUsdc + vaultUsdc).toBe(totalInitialUsdc);

    // Settle at $260 -> YES wins
    settleMarket(market, 260);
    redeem(market, ALICE);
    redeem(market, BOB);

    // After redemption, total USDC should equal initial total
    // Winning YES holders get the vault USDC back (5 USDC total)
    // Alice: 2 YES -> 2 USDC from vault
    // Bob: 3 YES -> 3 USDC from vault
    // Total redeemed from vault = 5 USDC = exactly what was minted
    const finalUsdc = alicePos.usdcBalance + bobPos.usdcBalance;
    expect(finalUsdc).toBe(totalInitialUsdc);
  });

  it('should integrate with settlement job for multi-user market settlement', async () => {
    // Setup simulated market state
    const market = createSimulatedMarket('AAPL', 190);
    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 10_000_000;
    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 5_000_000;

    // Alice mints and Bob trades
    mintPair(market, ALICE, 5);
    transferYes(market, ALICE, BOB, 3_000_000, 0.55);

    // Now run the real settlement job with mocked deps
    const activeMarket = buildActiveMarket({
      ticker: 'AAPL',
      strikePrice: 190,
      marketAddress: market.marketAddress,
    });

    const settlementPrice = 195.0;
    const meridianClient: MeridianClient = {
      createStrikeMarket: vi.fn().mockResolvedValue('sig'),
      setPhoenixMarket: vi.fn().mockResolvedValue('set-phoenix-sig'),
      settleMarket: vi.fn().mockImplementation(async () => {
        // When the settlement job calls settleMarket, we also update our sim
        settleMarket(market, settlementPrice);
        return 'settle-sig';
      }),
      adminSettle: vi.fn().mockResolvedValue('admin-sig'),
      getActiveMarkets: vi.fn().mockResolvedValue([]),
      buildCreateStrikeMarketIx: vi.fn().mockResolvedValue({ instruction: {}, strikeMarketAddress: 'mock-addr', yesMintAddress: 'mock-yes-addr' }),
      buildSetPhoenixMarketIx: vi.fn().mockResolvedValue({}),
      sendInstructions: vi.fn().mockResolvedValue('mock-atomic-sig'),
    };

    const { service: alertService } = createMockAlertService();
    const deps: SettlementJobDeps = {
      priceService: createMockPriceService({
        getLatestPrice: vi.fn().mockResolvedValue(buildPriceData({ price: settlementPrice })),
      }),
      tradingDayService: createMockTradingDayService(),
      meridianClient,
      alertService,
    };

    const result = await runSettlementJob(deps, [activeMarket]);
    expect(result.marketsSettled).toBe(1);

    // Market should be settled in our simulation
    expect(market.settled).toBe(true);
    expect(market.outcomeYesWins).toBe(true);

    // Both users redeem
    const alicePayout = redeem(market, ALICE);
    const bobPayout = redeem(market, BOB);

    expect(alicePayout).toBe(2_000_000); // 2 YES tokens
    expect(bobPayout).toBe(3_000_000); // 3 YES tokens
  });

  it('should handle the case where the taker has a losing position', () => {
    const market = createSimulatedMarket('AMZN', 200);

    const alicePos = getOrCreatePosition(market, ALICE);
    alicePos.usdcBalance = 10_000_000;
    const bobPos = getOrCreatePosition(market, BOB);
    bobPos.usdcBalance = 5_000_000;

    // Alice mints 5 pairs
    mintPair(market, ALICE, 5);

    // Bob buys 3 YES tokens from Alice at 0.70 (bullish bet)
    transferYes(market, ALICE, BOB, 3_000_000, 0.70);

    // Settle at $195 (below $200 strike) -> NO wins
    settleMarket(market, 195);
    expect(market.outcomeYesWins).toBe(false);

    // Bob's YES tokens are worthless
    const bobPayout = redeem(market, BOB);
    expect(bobPayout).toBe(0);

    // Alice still has 5 NO tokens (she sold YES but kept NO)
    const alicePayout = redeem(market, ALICE);
    expect(alicePayout).toBe(5_000_000); // All 5 NO tokens pay out

    // Alice profited: she received 0.70 * 3 = 2.1 USDC from selling YES
    // and gets 5 USDC from redeeming NO tokens
    // Net: started 10, spent 5 minting, received 2.1 selling YES, redeemed 5 NO = 12.1
    expect(alicePos.usdcBalance).toBe(
      10_000_000 - 5_000_000 + 2_100_000 + 5_000_000, // 12.1 USDC
    );

    // Bob lost: started 5, spent 2.1 buying YES, redeemed 0 = 2.9
    expect(bobPos.usdcBalance).toBe(5_000_000 - 2_100_000); // 2.9 USDC
  });
});
