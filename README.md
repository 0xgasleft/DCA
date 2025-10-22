# InkDCA - Automated Dollar-Cost Averaging on Ink

<div align="center">

![InkDCA Logo](public/ink_dca_logo.png)

**Trust minimized, Automated DCA Protocol on Ink Blockchain**

</div>

---

## Overview

**InkDCA** is a fully decentralized, trust minimized Dollar-Cost Averaging (DCA) platform built on the Ink blockchain. It enables users to automate their crypto investments by scheduling daily purchases of tokens like kBTC, ETH, and other supported assets, removing the need for manual intervention and emotional decision-making.

### Key Features

- ✅ **Trust minimized*** - Your funds never leave your control; all operations are executed on-chain via smart contracts
- ⏰ **Scheduled Execution** - Set your preferred time and frequency; purchases execute automatically at the exact time you choose
- 💰 **Multiple Token Pairs** - Support for various DCA strategies (ETH → kBTC, USDC → ETH, etc.)
- 📊 **Real-time Statistics** - Track your DCA performance with volume metrics and purchase history
- 🔒 **Optimal Pricing** - Automatic routing through Relay Reservoir for best available prices
- 🌓 **Dark Mode** - Beautiful UI with automatic theme detection based on system preferences
- 📈 **Price Impact Tracking** - View actual execution metrics including price impact and slippage
- ⚡ **Powered by Relay** - Automated execution infrastructure ensuring guaranteed daily purchases
- 🎨 **Modern UI/UX** - Clean, responsive design built with React and Tailwind CSS

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
- **Supabase** - Database for statistics and purchase history
- **Upstash** - Background job scheduling (QStash)
- **Vercel Analytics** - Performance monitoring

### Blockchain
- **Ink Network** - EVM-compatible L2 blockchain
- **Relay Reservoir** - Advanced routing protocol for optimal swap execution
- **Solidity Smart Contracts** - DCA logic and automation

---

## Getting Started

### Prerequisites

- **Node.js** v18+ and npm/yarn
- **MetaMask** or **Rabby** wallet
- **Ink Network RPC** endpoint
- **Supabase** account (for stats tracking)
- **Upstash** account (for background jobs)

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
# Smart Contract Configuration
CONTRACT_ADDRESS="YOUR_DEPLOYED_DCA_ON_INK_CONTRACT_ADDRESS"
VITE_CONTRACT_ADDRESS="YOUR_DEPLOYED_DCA_ON_INK_CONTRACT_ADDRESS"

# RPC Configuration
VITE_RPC_URL="https://rpc.ink.network"
RPC_URL="https://rpc.ink.network"
RPC_VISUALIZE_URL="https://rpc.ink.network"

# Wallet Configuration (for backend automation)
PK="your_private_key_here"

# Database (Supabase)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"

# Background Jobs (Upstash QStash)
UPSTASH_CHECK_BUYERS_ID="your_qstash_schedule_id"
UPSTASH_SYNC_CACHE_ID="your_qstash_cache_sync_id"
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

The InkDCA smart contract is the core of the platform, handling all DCA logic, fund management, and automated execution. It's deployed on the **Ink Network** and integrates with **Relay Reservoir** for token swaps.

### Key Contract Features

- **Multi-token DCA Support** - Users can create DCA strategies for any ERC20 token pair
- **Trust Minimized Fund Management** - Funds are held in the contract and only released during scheduled purchases
- **Configurable Scheduling** - Users set their own daily amount, duration, and execution time (UTC)
- **Automatic Execution** - Off-chain relay service triggers daily purchases at the specified time
- **Fee Mechanism** - 0.1% fee on total DCA volume (with configurable minimums per token)
- **Refund System** - Users can stop their DCA anytime and receive remaining funds
- **Price Protection** - Integrated with Relay Reservoir for optimal pricing and slippage protection

### Main Contract Functions

```solidity
// Register a new DCA with ETH as source
function registerForDCAWithETH(
    address destinationToken,
    uint256 amountPerDay,
    uint256 days,
    uint256 buyTime
) external payable

// Register a new DCA with ERC20 token as source
function registerForDCAWithToken(
    address sourceToken,
    address destinationToken,
    uint256 amountPerDay,
    uint256 days,
    uint256 buyTime
) external

// Stop DCA and claim refund
function giveUpDCA(address destinationToken) external

// View user's DCA configuration
function getDCAConfig(address user, address destinationToken)
    external view returns (DCAConfig memory)

// Execute DCA purchase (called by authorized executor)
function runDCA(
        address _buyer,
        address _destinationToken,
        RelayStep[] calldata steps
    )external
```

### How It Works

1. **Registration**: User deposits funds (ETH or ERC20) into the contract along with DCA parameters
2. **Storage**: Contract stores user's configuration (daily amount, duration, execution time)
3. **Execution**: Authorized relay service calls `runDCA` at the scheduled time each day
4. **Swap**: Contract swaps the daily amount via Relay Reservoir and sends purchased tokens to user
5. **Tracking**: Days remaining decrements; when zero, DCA ends automatically
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
    ┌────┴────┐
    ↓         ↓
┌────────┐  ┌──────────┐
│Supabase│  │ Upstash  │  ← Database & Job Queue
└────────┘  └──────────┘
         │
         ↓
┌─────────────────┐
│  Smart Contract │  ← On-chain DCA logic
│   (Ink Network) │
└─────────────────┘
         │
         ↓
┌─────────────────┐
│ Relay Reservoir │  ← Advanced router for swaps
└─────────────────┘
```

### Data Flow

1. **User Registration**
   - User connects wallet (MetaMask/Rabby) to the dApp
   - Selects token pair, daily amount, duration, and execution time
   - Approves token spending (if using ERC20)
   - Calls `registerForDCA*` function on smart contract
   - Backend records registration in Supabase

2. **Automated Execution**
   - Upstash QStash triggers `/api/run-dca` endpoint daily
   - Backend fetches active DCA sessions from smart contract
   - For each session due for execution, calls `executeDCABuy`
   - Relay Reservoir executes the swap with optimal pricing
   - Transaction details stored in Supabase
   - Price impact and slippage tracked for analytics

3. **User Dashboard**
   - Frontend queries Supabase for purchase history
   - Displays active sessions with progress bars
   - Shows real-time statistics and metrics
   - Allows users to stop DCA and claim refunds

---

## Features in Detail

### 1. Token Selection
- Browse available DCA pairs with real-time statistics
- View total volume registered/executed and purchase counts
- Expandable cards show multiple source token options per destination
- Stats powered by Relay infrastructure

### 2. DCA Configuration
- **Daily Amount**: Set how much to invest per day
- **Duration**: Choose investment period (1-365 days)
- **Execution Time**: Select exact time for daily purchases (local timezone)
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

### 5. Theme Support
- Automatic dark/light mode based on system preference
- Manual toggle with persistence to localStorage
- Smooth transitions across all components
- Optimized contrast for readability

---

## API Endpoints

All API routes are serverless functions deployed on Vercel.

### `/api/register-dca` (POST)
Stores DCA registration details in database.

### `/api/run-dca` (GET/POST)
Executes pending DCA purchases for all active users (called by Upstash QStash).

### `/api/get-dca-stats` (GET)
Fetches aggregated statistics for a token pair.

### `/api/get-purchase-history` (GET)
Retrieves purchase history for a user.

---

## Deployment

### Vercel Deployment

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Configure environment variables in Vercel Dashboard


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
- **Relay** - Automated execution infrastructure and Reservoir routing protocol
- **Vercel** - Hosting and serverless functions
- **Supabase** - Database and real-time features

---

<div align="center">

**Built with ❤️ for the Ink community**

</div>
