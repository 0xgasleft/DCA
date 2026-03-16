# InkDCA - Automated Dollar-Cost Averaging on Ink

<div align="center">

![InkDCA Logo](public/ink_dca_logo.png)

**Trust minimized, Automated DCA Protocol on Ink Blockchain**

[![Telegram](https://img.shields.io/badge/Telegram-Join%20Us-blue?logo=telegram&style=for-the-badge)](https://t.me/+qzZO0ePqZts3YmQ0)
[![X (Twitter)](https://img.shields.io/badge/X-Follow%20Us-black?logo=x&style=for-the-badge)](https://x.com/ink_dca)

</div>

---

## Overview

**InkDCA** is a fully decentralized, trust minimized Dollar-Cost Averaging (DCA) platform built on the Ink blockchain. It enables users to automate their crypto investments by scheduling daily purchases of tokens like kBTC, ETH, ANITA and other supported assets, removing the need for manual intervention and emotional decision-making.

### Key Features

- **Trust minimized** - Your funds never leave your control; all operations are executed on-chain via smart contracts
- **Scheduled Execution** - Set your preferred time and frequency; purchases execute automatically at the exact time you choose
- **Multiple Token Pairs** - Support for various DCA strategies (ETH → kBTC, USDT0 → ETH, USDT0 → ANITA, etc.)
- **Real-time Statistics** - Track your DCA performance with volume metrics and purchase history
- **Optimal Pricing** - Automatic routing through Relay Protocol for best available prices
- **Price Impact Tracking** - View actual execution metrics including price impact and slippage
- **ROI Metrics** - Compare DCA performance vs lump-sum investment at registration price
- **Hall of Fame** - Leaderboard ranking users by volume, consistency, and diversity
- **Dark Mode** - Beautiful UI with automatic theme detection based on system preferences
- **Modern UI/UX** - Clean, responsive design built with React and Tailwind CSS

---

## Table of Contents

- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Smart Contract](#smart-contract)
- [Architecture](#architecture)
- [Features in Detail](#features-in-detail)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Technology Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **ethers.js v6** - Ethereum wallet integration
- **Sonner** - Toast notifications
- **React Icons** - Icon library

### Backend & Infrastructure
- **Vercel** - Hosting and serverless functions
- **Supabase** - Database for statistics and purchase history cache
- **Upstash QStash** - Background job scheduling (cron triggers)
- **Upstash Redis** - Rate limiting across serverless instances
- **Vercel Analytics** - Performance monitoring

### Blockchain
- **Ink Network** - EVM-compatible L2 blockchain
- **Relay Protocol** - Advanced routing protocol for optimal swap execution
- **Solidity Smart Contracts** - DCA logic and automation

---

## Getting Started

### Prerequisites

- **Node.js** v18+ and npm/yarn
- **MetaMask** or **Rabby** wallet
- **Ink Network RPC** endpoint
- **Supabase** account (for stats tracking)
- **Upstash** account (for background jobs and rate limiting)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ink-dca.git
   cd ink-dca/WebApp/ink-dca
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Smart Contract
CONTRACT_ADDRESS="YOUR_DEPLOYED_DCA_ON_INK_CONTRACT_ADDRESS"
VITE_CONTRACT_ADDRESS="YOUR_DEPLOYED_DCA_ON_INK_CONTRACT_ADDRESS"

# RPC
VITE_RPC_URL="https://rpc-qnd.inkonchain.com"
RPC_URL="https://rpc-qnd.inkonchain.com"
RPC_VISUALIZE_URL="https://rpc-qnd.inkonchain.com"

# Wallet (backend execution)
PK="your_private_key_here"

# Database (Supabase)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"

# Background Jobs (Upstash QStash)
UPSTASH_CHECK_BUYERS_ID="your_qstash_schedule_id"
UPSTASH_SYNC_CACHE_ID="your_qstash_cache_sync_id"

# Rate Limiting (Upstash Redis — via Vercel marketplace)
KV_REST_API_URL="https://your-redis.upstash.io"
KV_REST_API_TOKEN="your_redis_token"

# Admin
VISUALIZER_PASSWORD="your_visualizer_password_here"
```

**Important:** Never commit your `.env` file to version control.

### Running Locally

1. **Development server**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173`

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Preview production build**
   ```bash
   npm run preview
   ```

---

## Smart Contract

### Overview

The InkDCA smart contract is the core of the platform, handling all DCA logic, fund management, and automated execution. It's deployed on the **Ink Network** and integrates with **Relay Protocol** for token swaps.

### Key Contract Features

- **Multi-token DCA Support** - Users can create DCA strategies for ETH or any ERC20 token as source
- **Trust Minimized Fund Management** - Funds are held in the contract and only released during scheduled purchases
- **Configurable Scheduling** - Users set their own daily amount, duration, and execution time (UTC, HHMM format)
- **Automatic Execution** - Off-chain relay service triggers daily purchases at the specified time
- **Fee Mechanism** - Configurable minimum fee per token (set by owner), with per-user fee exemptions
- **Refund System** - Users can stop their DCA anytime via `giveUpDCA` and receive remaining funds
- **Whitelist Security** - All swap target addresses are whitelisted per source token; owner can update via `setWhitelistedTo`
- **Emergency Functions** - Owner can trigger emergency refunds for all users or withdraw lost native ETH

### Main Contract Functions

```solidity
// Register a new DCA with ETH as source
function registerForDCAWithETH(
    address _destinationToken,
    uint256 _amount_per_day,
    uint256 _days_left,
    uint256 _buy_time
) external payable

// Register a new DCA with ERC20 token as source
function registerForDCAWithToken(
    address _sourceToken,
    address _destinationToken,
    uint256 _amount_per_day,
    uint256 _days_left,
    uint256 _buy_time
) external

// Stop DCA and claim refund
function giveUpDCA(address _destinationToken) external

// View user's DCA configuration
function getDCAConfig(address user, address destinationToken)
    external view returns (DCAConfig memory)

// Execute DCA purchase (owner only)
function runDCA(
    address _buyer,
    address _destinationToken,
    RelayStep[] calldata steps
) external

// Add or remove a whitelisted swap target (owner only)
function setWhitelistedTo(address _token, address _to, bool _whitelist) external
```

### How It Works

1. **Registration**: User deposits funds (ETH or ERC20) into the contract along with DCA parameters
2. **Storage**: Contract stores user's configuration (daily amount, duration, execution time)
3. **Execution**: Owner wallet calls `runDCA` at the scheduled time each day with Relay swap steps
4. **Swap**: Contract validates whitelist, executes steps via Relay Protocol, tracks balance delta, sends purchased tokens to user
5. **Tracking**: Days remaining decrements; when zero, DCA session is cleaned up automatically
6. **Early Exit**: User can call `giveUpDCA` anytime to stop and receive unspent funds

---

## Architecture

### System Components

```
┌─────────────────┐
│   React App     │  ← User Interface (Vite + React)
│   (Frontend)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Vercel Functions│  ← API endpoints (/api/*)
│   (Serverless)  │
└────────┬────────┘
         │
    ┌────┴──────────┐
    ↓               ↓
┌────────┐  ┌──────────────┐
│Supabase│  │    Upstash   │  ← Database, Job Queue & Rate Limiting
└────────┘  └──────────────┘
         │
         ↓
┌─────────────────┐
│  Smart Contract │  ← On-chain DCA logic
│   (Ink Network) │
└─────────────────┘
         │
         ↓
┌─────────────────┐
│ Relay Protocol  │  ← Advanced router for swaps
└─────────────────┘
```

### Data Flow

1. **User Registration**
   - User connects wallet (MetaMask/Rabby) to the dApp
   - Selects token pair, daily amount, duration, and execution time
   - Approves token spending (if using ERC20)
   - Calls `registerForDCAWithETH` or `registerForDCAWithToken` on smart contract
   - Frontend calls `/api/register-dca` to record stats and initial price snapshot in Supabase

2. **Automated Execution**
   - Upstash QStash triggers `/api/check-buyers` every 15 minutes
   - Backend fetches active buyers from the contract, matches sessions due at the current time slot
   - For each matched session, fetches a Relay quote and calls `runDCA` on the contract
   - Relay Protocol executes the swap with optimal pricing
   - Execution attempt, price impact and stats stored in Supabase

3. **User Dashboard**
   - Frontend queries `/api/portfolio` for purchase history and ROI metrics
   - Displays active sessions with progress bars and countdown timers
   - Shows execution history with price impact per swap
   - Allows users to stop DCA and claim refunds

---

## Features in Detail

### 1. Token Selection
- Browse available DCA pairs with real-time statistics
- View total volume registered/executed and purchase counts
- Expandable cards show multiple source token options per destination

### 2. DCA Configuration
- **Daily Amount**: Set how much to invest per day
- **Duration**: Choose investment period (1-365 days)
- **Execution Time**: Select exact time for daily purchases (local timezone, converted to UTC)
- **Balance Check**: Real-time wallet balance validation
- **Token Approval**: One-click ERC20 approval with progress tracking
- **Expected Metrics**: Preview price impact and total allocation before registration

### 3. Active Strategies
- Visual progress bars showing time until next purchase
- Detailed metrics: daily amount, days remaining, total refundable
- Real-time countdown timers
- One-click stop & refund with confirmation

### 4. Purchase History
- Complete timeline of executed purchases
- Actual price impact and slippage for each swap
- Links to block explorer for transaction verification
- Formatted dates and amounts with proper decimals

### 5. ROI Metrics (Portfolio Performance)
- Per-session comparison: DCA tokens received vs lump-sum at registration price
- Completion percentage and session status (active / completed / cancelled)
- Price volatility: min/max/avg exchange rate across executions
- Win rate across completed sessions

### 6. Hall of Fame
- Public leaderboard ranking all users by score
- Score factors: USD volume, consistency (completion rate), diversity (token pairs), commitment (avg session length)
- Tiers: Beginner → Rookie → Confirmed → Professional → Expert → Legend

### 7. Theme Support
- Automatic dark/light mode based on system preference
- Manual toggle with persistence to localStorage

---

## API Endpoints

All API routes are serverless functions deployed on Vercel.

### Public Endpoints

#### `/api/get-dca-stats` (GET)
Aggregated statistics for a token pair.
- Params: `?source=0x...&destination=0x...`
- Returns: `volume_registered`, `volume_executed`, `purchase_count`
- Rate limit: 60 requests/min per IP

#### `/api/portfolio` (GET)
User-specific data. Two modes via `type` query param:
- `?address=0x...&type=purchase-history` — Full purchase history with price impact per swap
- `?address=0x...&type=roi-metrics` — ROI performance metrics per DCA session
- Rate limit: 10 requests per 30s per IP

#### `/api/get-hall-of-fame` (GET)
Ranked leaderboard of all users with scores, tiers, and stats.
- Rate limit: 10 requests/min per IP

### User-Facing Endpoints

#### `/api/register-dca` (POST)
Called by the frontend after a successful on-chain registration. Records stats and initial price snapshot for ROI tracking.
- Body: `{ address, buy_time, source_token, destination_token, tx_hash, amount_per_day, days_left, block_number }`

### Protected Endpoints (Upstash QStash only)

#### `/api/check-buyers` (GET)
Cron job — runs every 15 minutes, matches sessions due for execution, triggers swap execution.
- Auth: `upstash-schedule-id` header

#### `/api/sync-purchase-cache` (GET/POST)
Syncs on-chain purchase events to Supabase cache.
- Auth: `upstash-schedule-id` header

### Admin Endpoints (password protected)

#### `/api/get-dca-attempt-stats` (GET/POST)
Execution attempt tracking: success/fail rate, daily timeline, top errors, router usage.
- Params: `password`, optional `buyer`, `token`, `days`

#### `/api/sync-visualization` (POST)
Syncs all on-chain events (registrations, purchases, cancellations) to Supabase visualization cache.
- Body: `{ password }`

#### `/api/get-visualization` (POST)
Returns cached visualization data for the admin dashboard.
- Body: `{ password }`

---

## Deployment

### Vercel Deployment

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Configure all environment variables in Vercel Dashboard

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

### Development Guidelines

- Follow existing code style (ESLint configuration)
- Add dark mode support to any new UI components
- Test with both MetaMask and Rabby wallets
- Ensure responsive design works on mobile

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- **Ink Network** - L2 blockchain infrastructure
- **Relay Protocol** - Automated execution infrastructure and routing
- **Vercel** - Hosting and serverless functions
- **Supabase** - Database and caching
- **Upstash** - Job scheduling and rate limiting

---

<div align="center">

**Built with ❤️ for the Ink community**

</div>
