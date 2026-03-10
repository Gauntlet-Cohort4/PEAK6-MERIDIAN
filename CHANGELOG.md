# Changelog

All notable changes to the Meridian project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Phase 1: Scaffold
- Project scaffold and monorepo structure (shared, automation, app, programs)
- Shared library with error types, logger, debug flags, tracing, constants, types
- Trading calendar with NYSE 2026 holidays
- Adapter interfaces for orderbook, price service, and trading day

#### Phase 2: Smart Contract
- Anchor program skeleton with error codes and constants
- CI workflow for linting, testing, and building

#### Phase 3: Automation Service
- Morning job orchestration: fetch prices, calculate strikes, create markets
- Settlement job orchestration: settle markets via oracle, admin fallback
- Pyth Hermes client with retry logic and health checks
- Strike calculator with configurable offsets and rounding
- Trading day service with Finnhub holiday integration
- Demo mode with mock data for all services
- Transaction sender with retry logic
- Zod-based config validation

#### Phase 3B: Wire Automation to IDL
- MeridianClient typed interface for Anchor program interactions
- Wire morning job to use MeridianClient.createStrikeMarket
- Wire settlement job to use MeridianClient.settleMarket and adminSettle
- Structured instruction building with TODO markers for IDL import

#### Phase 4: Frontend
- Next.js 15 app with React 19 and Tailwind CSS
- Market list and card components with ticker filtering
- Trade panel with order book, payoff display, position constraints
- Trade confirmation dialog with cost breakdown
- Settlement timer with real-time countdown
- Portfolio and history pages
- Wallet button component (stub)
- Implied probability calculations from order book prices
- PnL calculations for positions
- Perspective transforms for YES/NO token views
- Structured format utilities for prices, percentages, dates

#### Phase 4B: Wire Frontend TX Builders
- Transaction builder layer: mint_pair, buy_no, sell_no, redeem
- Typed transaction builder interfaces with validation
- Phoenix interop adapter for Kit/web3.js address conversion
- Wire useTradeActions hook to use tx builders

#### Phase 5: Integration Scripts & Demo
- Full lifecycle demo script (scripts/demo.ts)
- Deployment script (scripts/deploy.ts)
- Devnet setup script (scripts/setup-devnet.ts)
- Updated Makefile with demo, deploy, and setup-devnet targets
- Integration test documentation with Surfpool approach
- Comprehensive project README with architecture diagram
