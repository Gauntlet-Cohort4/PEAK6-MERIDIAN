# BinBar Demo Walkthrough

## Prerequisites

- Phantom wallet installed, set to **Devnet**
- Wallet funded with SOL (tx fees) and test USDC
- App running at http://localhost:3002 (`cd app && npm run dev`)
- Markets created via morning job or `npx tsx scripts/test-full-pipeline.ts`

### Fund Your Wallet

```bash
# SOL for transaction fees
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url https://api.devnet.solana.com

# Test USDC (run from project root — mints 100 USDC to admin, then transfer)
npx tsx scripts/mint-test-usdc.ts
```

---

## Step 1: Connect Wallet

1. Open http://localhost:3002
2. Click **Connect** (top-right)
3. Select **Phantom**
4. Approve the connection in Phantom

## Step 2: Browse Markets

1. Click **MARKETS** in the nav bar
2. You'll see ticker groups (AAPL, MSFT, GOOGL, etc.) with live prices
3. Click a ticker group to expand — shows individual strike contracts
4. Each card shows: strike price, current stock price, status, mini chart

## Step 3: Open a Trade

1. Click any strike card (e.g., "AAPL $230.00")
2. You're now on the trade page with:
   - **Left**: Price chart + order books (YES and NO)
   - **Right**: Trade panel with tabs

## Step 4: Buy YES

> "I think the stock will close AT or ABOVE the strike price"

1. Select the **Buy Yes** tab (green)
2. Enter **Size**: `1` (1 contract = 1 USDC)
3. Click **Submit Order**
4. Review the confirmation modal — shows max profit/loss
5. Click **Confirm Trade**
6. **Phantom pops up** — approve the transaction
7. Toast notification shows the transaction signature
8. You now hold 1 YES token (and 1 NO token from the mint pair)

## Step 5: Sell YES (Close Position)

> "I changed my mind, or I want to take profit"

1. Select the **Sell Yes** tab (red)
2. Click **Max** to auto-fill your YES balance
3. Click **Submit Order** → **Confirm Trade**
4. Phantom approves — your YES+NO tokens are burned, USDC returned

## Alternative: Buy NO

> "I think the stock will close BELOW the strike price"

1. Select the **Buy No** tab (red)
2. Enter **Size** and **Price** (0.01–0.99)
3. Submit → Confirm → Phantom approves
4. Behind the scenes: mints YES+NO pair, sells YES on Phoenix, you keep NO

## Step 6: Wait for Settlement

- Markets settle at **4:05 PM ET** automatically
- The automation service fetches the closing price from Pyth
- If close >= strike → YES wins. If close < strike → NO wins.
- Market status changes from OPEN/PENDING → SETTLED

## Step 7: Redeem Winnings

1. Navigate to **PORTFOLIO**
2. Settled positions appear under "Settled - Ready to Redeem"
3. Click **Redeem** on your winning position
4. Phantom approves — winning tokens burned, USDC deposited to your wallet
5. Each winning token = 1 USDC

---

## Position Rules

| You Hold | Can Do | Cannot Do |
|----------|--------|-----------|
| Nothing | Buy YES, Buy NO | Sell |
| YES tokens | Buy more YES, Sell YES | Buy NO |
| NO tokens | Buy more NO, Sell NO | Buy YES |
| Both | Sell YES, Sell NO | Buy |

---

## What Each Action Costs

| Action | You Pay | You Receive |
|--------|---------|-------------|
| Buy YES | 1 USDC per contract | 1 YES + 1 NO token |
| Buy NO | USDC (size x price) | NO tokens (YES sold on Phoenix) |
| Sell YES | YES + NO tokens burned | 1 USDC per pair |
| Sell NO | Buys YES from Phoenix + burns pair | USDC |
| Redeem (win) | Winning tokens burned | 1 USDC per token |
| Redeem (lose) | N/A | Nothing (tokens worthless) |

---

## Quick Test (Single Buy)

Fastest way to verify the full flow:

1. Connect Phantom (devnet, funded)
2. Markets → click any PENDING strike
3. Buy Yes, Size: 1 → Confirm → Phantom approve
4. Verify on [Solana Explorer](https://explorer.solana.com/?cluster=devnet): search your wallet, check recent tx
5. Sell Yes, Max → Confirm → Phantom approve
6. USDC returned to wallet
