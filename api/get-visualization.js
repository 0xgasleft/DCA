import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_VISUALIZE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const VISUALIZER_PASSWORD = process.env.VISUALIZER_PASSWORD;
const START_BLOCK = 28_000_000;

const CONTRACT_ABI = [
  "function getRegisteredBuyers() view returns (address[] memory)",
  "function getDCAConfig(address user, address destinationToken) view returns (address sourceToken, address destinationToken, uint256 amount_per_day, uint256 days_left, bool isNativeETH, uint256 buy_time)",
  "function owner() view returns (address)",
  "function getTokenMinFee(address token) view returns (uint256)",
  "function feeTreasury() view returns (address)",
  "function isExemptedFromFees(address user) view returns (bool)"
];

// Per DCAOnInk.sol register*: fee paid to feeTreasury is exactly tokenMinFees[sourceToken],
// charged once at registration in the source token, NOT refunded on cancel.
// Fee-exempted users pay nothing.

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)"
];

const tokenInfoCache = new Map();
const blockTimestampCache = new Map();

// Fallback only — used if no recent purchase receipts can be fetched.
// Real cost is measured from on-chain receipts of recent executions (see getRecentExecutionCost).
const FALLBACK_GAS_PER_EXEC_ETH = parseFloat(process.env.AVG_GAS_PER_EXEC_ETH || "0.00005");

// Sample the last N purchase tx receipts and average gasUsed × effectiveGasPrice.
// This is the actual cost the cron pays per DCA, so runway calc reflects reality
// instead of a hardcoded estimate that drifts as gas/contract logic change.
async function getRecentExecutionCost(provider, purchaseEvents, sampleSize = 10) {
  const recent = [...purchaseEvents]
    .filter(e => e.transactionHash)
    .sort((a, b) => (b.blockTimestamp ?? 0) - (a.blockTimestamp ?? 0))
    .slice(0, sampleSize);
  if (recent.length === 0) return null;

  const costs = [];
  for (const e of recent) {
    try {
      const receipt = await provider.getTransactionReceipt(e.transactionHash);
      if (!receipt) continue;
      const gasUsed = receipt.gasUsed;
      let gasPrice = receipt.gasPrice;
      if (gasPrice == null) {
        const tx = await provider.getTransaction(e.transactionHash);
        gasPrice = tx?.gasPrice;
      }
      if (gasPrice == null) continue;
      const costEth = parseFloat(ethers.formatEther(gasUsed * gasPrice));
      if (isFinite(costEth) && costEth > 0) costs.push(costEth);
    } catch (err) {
      console.error(`Failed to fetch receipt for ${e.transactionHash}:`, err.message);
    }
  }
  if (costs.length === 0) return null;
  return costs.reduce((s, v) => s + v, 0) / costs.length;
}

async function getEthPrice() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await response.json();
    return data.ethereum?.usd ?? null;
  } catch (error) {
    console.error("Failed to fetch ETH price:", error.message);
    return null;
  }
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

async function getTokenInfo(tokenAddress, provider) {
  const normalizedAddress = tokenAddress.toLowerCase();

  if (tokenInfoCache.has(normalizedAddress)) {
    return tokenInfoCache.get(normalizedAddress);
  }

  if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
    const info = { decimals: 18, symbol: 'ETH' };
    tokenInfoCache.set(normalizedAddress, info);
    return info;
  }

  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [decimals, symbol] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.symbol()
    ]);

    const info = { decimals: Number(decimals), symbol };
    tokenInfoCache.set(normalizedAddress, info);
    return info;
  } catch (error) {
    console.error(`Failed to get token info for ${tokenAddress}:`, error);
    return { decimals: 18, symbol: 'UNKNOWN' };
  }
}

async function getBlockTimestamp(blockNumber, provider) {
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber);
  }

  const block = await provider.getBlock(blockNumber);
  const timestamp = block.timestamp;
  blockTimestampCache.set(blockNumber, timestamp);
  return timestamp;
}

async function batchedPromiseAll(items, fn, concurrency = 30) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { password } = req.body;

    if (!password || password !== VISUALIZER_PASSWORD) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log("Fetching visualization cache and live contract state...");

    const { data: cacheData, error: cacheError } = await supabase
      .from("visualization_cache")
      .select("*")
      .eq("id", "global")
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error("Error fetching cache:", cacheError);
      return res.status(500).json({ error: "Failed to fetch cache", details: cacheError.message });
    }

    if (!cacheData) {
      return res.status(200).json({
        overview: {
          uniqueWallets: 0,
          totalRegistrations: 0,
          totalPurchasesExecuted: 0,
          totalActiveSessions: 0,
          totalCancelledSessions: 0,
          totalTokenPairs: 0,
          averagePurchasesPerSession: 0,
          completionRate: 0
        },
        sourceTokenVolumes: [],
        destinationTokenVolumes: [],
        dailyActivity: [],
        tokenPairs: [],
        metadata: {
          currentBlock: await provider.getBlockNumber(),
          lastSyncedBlock: START_BLOCK,
          dataFetchedAt: new Date().toISOString(),
          contractAddress: CONTRACT_ADDRESS,
          needsSync: true
        }
      });
    }

    const currentBlock = await provider.getBlockNumber();
    const lastSyncedBlock = cacheData.last_synced_block;
    const registrationEvents = cacheData.registration_events || [];
    const purchaseEvents = cacheData.purchase_events || [];
    const destroyEvents = cacheData.destroy_events || [];

    console.log(`Processing ${registrationEvents.length} registrations, ${purchaseEvents.length} purchases, ${destroyEvents.length} cancellations`);

    
    console.log("Querying live contract state...");
    const registeredBuyers = await contract.getRegisteredBuyers();
    console.log(`Live registered buyers from contract: ${registeredBuyers.length}`);

    
    const liveActiveSessions = new Map(); 
    const uniqueActiveWallets = new Set();

    // Build buyer -> destTokens map from cached registration events (no RPC needed)
    const buyerDestTokensMap = new Map();
    for (const regEvent of registrationEvents) {
      const buyerLower = regEvent.args.buyer.toLowerCase();
      const destToken = regEvent.args.destinationToken.toLowerCase();
      if (!buyerDestTokensMap.has(buyerLower)) buyerDestTokensMap.set(buyerLower, new Set());
      buyerDestTokensMap.get(buyerLower).add(destToken);
    }

    // Fetch all getDCAConfig calls in parallel (batched to avoid RPC overload)
    registeredBuyers.forEach(b => uniqueActiveWallets.add(b.toLowerCase()));

    const allConfigCalls = registeredBuyers.flatMap(buyer => {
      const buyerLower = buyer.toLowerCase();
      const destTokens = buyerDestTokensMap.get(buyerLower) || new Set();
      return Array.from(destTokens).map(destToken => ({ buyer, buyerLower, destToken }));
    });

    // Buy-time histogram populated from LIVE config (not historical events) so it always
    // reflects currently scheduled DCAs, immune to stale event cache.
    const buyTimeHistogram = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));

    await batchedPromiseAll(allConfigCalls, async ({ buyer, buyerLower, destToken }) => {
      try {
        const config = await contract.getDCAConfig(buyer, destToken);
        if (Number(config.days_left) > 0) {
          if (!liveActiveSessions.has(buyerLower)) liveActiveSessions.set(buyerLower, new Set());
          liveActiveSessions.get(buyerLower).add(destToken);

          // buy_time is uint256 in HHMM format (e.g. 1900 = 19:00 UTC)
          const buyTime = Number(config.buy_time ?? 0);
          const hour = Math.floor(buyTime / 100);
          if (hour >= 0 && hour < 24) buyTimeHistogram[hour].count += 1;
        }
      } catch (err) {
        console.log(`No active session for ${buyer} -> ${destToken}`);
      }
    }, 20);


    let totalActiveSessions = 0;
    const activeSessionsByTokenMap = new Map(); // destToken (lower) -> count
    liveActiveSessions.forEach((tokenSet, buyer) => {
      console.log(`  Buyer ${buyer}: ${tokenSet.size} active session(s) - tokens: ${Array.from(tokenSet).join(', ')}`);
      totalActiveSessions += tokenSet.size;
      tokenSet.forEach(t => activeSessionsByTokenMap.set(t, (activeSessionsByTokenMap.get(t) || 0) + 1));
    });

    console.log(`Live active sessions: ${totalActiveSessions}`);
    console.log(`Live unique active wallets: ${uniqueActiveWallets.size}`);
    console.log(`Breakdown: ${uniqueActiveWallets.size} buyers with ${totalActiveSessions} total active sessions`);

    
    const uniqueLifetimeWallets = new Set();
    const volumeBySourceToken = new Map();
    const volumeByDestinationToken = new Map();
    let totalRegistrations = registrationEvents.length;
    let totalPurchasesExecuted = purchaseEvents.length;
    const dailyActivity = new Map();
    const tokenPairs = new Map();
    let lastExecutionTimestamp = null;

    // Timestamps are now stored in cache by sync-visualization - no RPC needed here
    // Pre-fetch only token infos (just 4 unique tokens)
    const uniqueTokenAddresses = [...new Set([
      ...registrationEvents.flatMap(e => [e.args.sourceToken.toLowerCase(), e.args.destinationToken.toLowerCase()]),
      ...purchaseEvents.map(e => e.args.destinationToken.toLowerCase())
    ])];

    console.log(`Pre-fetching ${uniqueTokenAddresses.length} token infos...`);
    await batchedPromiseAll(uniqueTokenAddresses, addr => getTokenInfo(addr, provider), 10);
    console.log("Pre-fetch complete.");

    // Pre-fetch on-chain minFee for each unique source token (used for revenue calc)
    const sourceTokenAddrs = [...new Set(registrationEvents.map(e => e.args.sourceToken.toLowerCase()))];
    const minFees = new Map();
    await batchedPromiseAll(sourceTokenAddrs, async (addr) => {
      try {
        const fee = await contract.getTokenMinFee(addr);
        minFees.set(addr, BigInt(fee));
      } catch (err) {
        console.warn(`Failed to fetch minFee for ${addr}: ${err.message}`);
        minFees.set(addr, 0n);
      }
    }, 10);

    // Pre-fetch fee-exemption status for each unique buyer (exempted buyers pay no fee)
    const uniqueBuyers = [...new Set(registrationEvents.map(e => e.args.buyer.toLowerCase()))];
    const exempted = new Set();
    await batchedPromiseAll(uniqueBuyers, async (addr) => {
      try {
        if (await contract.isExemptedFromFees(addr)) exempted.add(addr);
      } catch (err) {
        console.warn(`Failed to fetch exemption for ${addr}: ${err.message}`);
      }
    }, 20);
    console.log(`Fee-exempted buyers: ${exempted.size}/${uniqueBuyers.length}`);

    // Revenue accumulators: bucket -> sourceToken -> fee in wei
    const nowSec = Math.floor(Date.now() / 1000);
    const sevenDaysAgoSec = nowSec - 7 * 86400;
    const thirtyDaysAgoSec = nowSec - 30 * 86400;
    const revenueByBucket = {
      lifetime: new Map(),
      monthly: new Map(),
      weekly: new Map()
    };
    const addRevenue = (bucket, token, feeWei) => {
      bucket.set(token, (bucket.get(token) ?? 0n) + feeWei);
    };

    for (const event of registrationEvents) {
      const buyer = event.args.buyer.toLowerCase();
      const sourceToken = event.args.sourceToken.toLowerCase();
      const destinationToken = event.args.destinationToken.toLowerCase();
      const amountPerDay = BigInt(event.args.amountPerDay);
      const daysLeft = BigInt(event.args.daysLeft);

      uniqueLifetimeWallets.add(buyer);

      const totalValue = amountPerDay * daysLeft;
      const sourceInfo = await getTokenInfo(sourceToken, provider);

      const sourceKey = `${sourceInfo.symbol}|${sourceToken}`;
      if (!volumeBySourceToken.has(sourceKey)) {
        volumeBySourceToken.set(sourceKey, {
          symbol: sourceInfo.symbol,
          address: sourceToken,
          totalVolume: 0n,
          decimals: sourceInfo.decimals,
          registrationCount: 0
        });
      }
      const sourceData = volumeBySourceToken.get(sourceKey);
      sourceData.totalVolume += totalValue;
      sourceData.registrationCount += 1;

      const timestamp = event.blockTimestamp;
      const date = timestamp ? new Date(timestamp * 1000).toISOString().split('T')[0] : 'unknown';
      if (!dailyActivity.has(date)) {
        dailyActivity.set(date, { registrations: 0, purchases: 0 });
      }
      dailyActivity.get(date).registrations += 1;

      const destInfo = await getTokenInfo(destinationToken, provider);
      const pairKey = `${sourceInfo.symbol} → ${destInfo.symbol}`;
      tokenPairs.set(pairKey, (tokenPairs.get(pairKey) || 0) + 1);

      // Per DCAOnInk: fee = tokenMinFees[sourceToken] sent to feeTreasury, unless buyer is exempted
      if (!exempted.has(buyer)) {
        const fee = minFees.get(sourceToken) ?? 0n;
        if (fee > 0n) {
          addRevenue(revenueByBucket.lifetime, sourceToken, fee);
          if (timestamp && timestamp >= thirtyDaysAgoSec) addRevenue(revenueByBucket.monthly, sourceToken, fee);
          if (timestamp && timestamp >= sevenDaysAgoSec) addRevenue(revenueByBucket.weekly, sourceToken, fee);
        }
      }
    }

    for (const event of purchaseEvents) {
      const buyer = event.args.buyer.toLowerCase();
      const destinationToken = event.args.destinationToken.toLowerCase();
      const amountOut = BigInt(event.args.amountOut);

      uniqueLifetimeWallets.add(buyer);

      const destInfo = await getTokenInfo(destinationToken, provider);

      const destKey = `${destInfo.symbol}|${destinationToken}`;
      if (!volumeByDestinationToken.has(destKey)) {
        volumeByDestinationToken.set(destKey, {
          symbol: destInfo.symbol,
          address: destinationToken,
          totalVolume: 0n,
          decimals: destInfo.decimals,
          purchaseCount: 0
        });
      }
      const destData = volumeByDestinationToken.get(destKey);
      destData.totalVolume += amountOut;
      destData.purchaseCount += 1;

      const timestamp = event.blockTimestamp;
      const date = timestamp ? new Date(timestamp * 1000).toISOString().split('T')[0] : 'unknown';
      if (!dailyActivity.has(date)) {
        dailyActivity.set(date, { registrations: 0, purchases: 0 });
      }
      dailyActivity.get(date).purchases += 1;

      if (timestamp && (lastExecutionTimestamp === null || timestamp > lastExecutionTimestamp)) {
        lastExecutionTimestamp = timestamp;
      }
    }

    
    console.log("Fetching contract balances for source tokens...");
    const contractBalances = new Map();

    for (const [key, data] of volumeBySourceToken.entries()) {
      try {
        let balance;
        if (data.address === '0x0000000000000000000000000000000000000000') {
          
          balance = await provider.getBalance(CONTRACT_ADDRESS);
        } else {
          
          const tokenContract = new ethers.Contract(data.address, ERC20_ABI, provider);
          balance = await tokenContract.balanceOf(CONTRACT_ADDRESS);
        }
        contractBalances.set(key, {
          raw: balance.toString(),
          formatted: ethers.formatUnits(balance, data.decimals)
        });
        console.log(`  ${data.symbol}: ${ethers.formatUnits(balance, data.decimals)}`);
      } catch (error) {
        console.error(`Failed to get balance for ${data.symbol}:`, error);
        contractBalances.set(key, {
          raw: '0',
          formatted: '0'
        });
      }
    }

    const sourceTokenVolumes = Array.from(volumeBySourceToken.values()).map(data => {
      const key = `${data.symbol}|${data.address}`;
      const balance = contractBalances.get(key) || { formatted: '0', raw: '0' };
      return {
        symbol: data.symbol,
        address: data.address,
        totalVolume: ethers.formatUnits(data.totalVolume, data.decimals),
        registrationCount: data.registrationCount,
        decimals: data.decimals,
        contractBalance: balance.formatted,
        contractBalanceRaw: balance.raw
      };
    }).sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));

    const destinationTokenVolumes = Array.from(volumeByDestinationToken.values()).map(data => ({
      symbol: data.symbol,
      address: data.address,
      totalVolume: ethers.formatUnits(data.totalVolume, data.decimals),
      purchaseCount: data.purchaseCount,
      decimals: data.decimals
    })).sort((a, b) => parseFloat(b.totalVolume) - parseFloat(a.totalVolume));

    const dailyActivityArray = Array.from(dailyActivity.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const tokenPairsArray = Array.from(tokenPairs.entries())
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count);

    console.log(`Lifetime unique wallets: ${uniqueLifetimeWallets.size}`);

    
    console.log("Fetching contract owner and balance...");
    let ownerAddress;
    let ownerBalance = '0';
    try {
      ownerAddress = await contract.owner();
      const balance = await provider.getBalance(ownerAddress);
      ownerBalance = ethers.formatEther(balance);
      console.log(`  Owner: ${ownerAddress}`);
      console.log(`  Owner balance: ${ownerBalance} ETH`);
    } catch (error) {
      console.error("Failed to fetch owner info:", error);
      ownerAddress = "Unknown";
    }

    // ---- Derived analytics ----

    // Build address→symbol map so frontend can resolve raw addresses (used by attempt-stats panels)
    const symbolMap = {};
    for (const t of [...sourceTokenVolumes, ...destinationTokenVolumes]) {
      symbolMap[t.address.toLowerCase()] = t.symbol;
    }

    // Active sessions broken down by destination token
    const activeSessionsByToken = Array.from(activeSessionsByTokenMap.entries())
      .map(([address, count]) => ({ address, symbol: symbolMap[address] || 'UNKNOWN', count }))
      .sort((a, b) => b.count - a.count);

    // Total USD volume of source tokens spent (stables 1:1, ETH at live price, others skipped)
    const ethPrice = await getEthPrice();
    const usdValue = (amount, symbol) => {
      if (!isFinite(amount) || amount === 0) return 0;
      const sym = (symbol || '').toUpperCase();
      if (sym.includes('USD') || sym === 'DAI') return amount;
      if ((sym === 'ETH' || sym === 'WETH') && ethPrice != null) return amount * ethPrice;
      return 0;
    };

    let totalUsdVolume = 0;
    for (const t of sourceTokenVolumes) {
      totalUsdVolume += usdValue(parseFloat(t.totalVolume), t.symbol);
    }
    totalUsdVolume = Math.round(totalUsdVolume * 100) / 100;

    // Build revenue breakdown per bucket — converts wei → token amount → USD where possible
    const buildRevenueBucket = (bucket) => {
      const byToken = [];
      let totalUsd = 0;
      for (const [addr, feeWei] of bucket.entries()) {
        const info = tokenInfoCache.get(addr) || { decimals: 18, symbol: 'UNKNOWN' };
        const amount = parseFloat(ethers.formatUnits(feeWei, info.decimals));
        const usd = usdValue(amount, info.symbol);
        totalUsd += usd;
        byToken.push({
          address: addr,
          symbol: info.symbol,
          amount: +amount.toFixed(6),
          amountRaw: feeWei.toString(),
          usd: +usd.toFixed(2)
        });
      }
      byToken.sort((a, b) => b.usd - a.usd);
      return { totalUsd: +totalUsd.toFixed(2), byToken };
    };

    const revenue = {
      lifetime: buildRevenueBucket(revenueByBucket.lifetime),
      monthly: buildRevenueBucket(revenueByBucket.monthly),
      weekly: buildRevenueBucket(revenueByBucket.weekly)
    };

    // Treasury: live balance held by the FeeTreasury contract (separate from DCAOnInk).
    // Address is read on-chain via DCAOnInk.feeTreasury(). Per FeeTreasury.sol it accepts
    // ETH (receive/fallback) and ERC20 tokens. Gap vs lifetime revenue estimate reflects
    // any owner withdrawals (withdrawFees / withdrawTokens).
    let treasury = null;
    try {
      const feeTreasuryAddress = await contract.feeTreasury();
      console.log(`FeeTreasury address: ${feeTreasuryAddress}`);

      const treasuryBalances = [];
      let treasuryTotalUsd = 0;
      const ethBal = await provider.getBalance(feeTreasuryAddress);
      const ethAmount = parseFloat(ethers.formatEther(ethBal));
      const ethUsd = usdValue(ethAmount, 'ETH');
      treasuryTotalUsd += ethUsd;
      treasuryBalances.push({
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        amount: +ethAmount.toFixed(8),
        usd: +ethUsd.toFixed(2)
      });
      for (const tokenAddr of sourceTokenAddrs) {
        if (tokenAddr === '0x0000000000000000000000000000000000000000') continue;
        try {
          const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
          const bal = await tokenContract.balanceOf(feeTreasuryAddress);
          const info = tokenInfoCache.get(tokenAddr) || { decimals: 18, symbol: 'UNKNOWN' };
          const amount = parseFloat(ethers.formatUnits(bal, info.decimals));
          const usd = usdValue(amount, info.symbol);
          treasuryTotalUsd += usd;
          treasuryBalances.push({
            address: tokenAddr,
            symbol: info.symbol,
            amount: +amount.toFixed(6),
            usd: +usd.toFixed(2)
          });
        } catch (err) {
          console.warn(`Failed to fetch treasury balance for ${tokenAddr}: ${err.message}`);
        }
      }
      treasuryBalances.sort((a, b) => b.usd - a.usd);
      treasury = {
        treasuryAddress: feeTreasuryAddress,
        totalUsd: +treasuryTotalUsd.toFixed(2),
        balances: treasuryBalances
      };
    } catch (err) {
      console.error('Failed to fetch treasury:', err.message);
    }

    // Execution rate over the last 7 days, used for runway estimate
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 86400;
    const recentPurchases = purchaseEvents.filter(e => e.blockTimestamp && e.blockTimestamp >= sevenDaysAgo);
    const avgExecutionsPerDay = recentPurchases.length / 7;
    const ownerBalanceNum = parseFloat(ownerBalance) || 0;

    // Measure real gas cost from recent execution receipts; fall back to constant if RPC unavailable
    const measuredGasPerExec = await getRecentExecutionCost(provider, purchaseEvents, 10);
    const gasPerExecEth = measuredGasPerExec ?? FALLBACK_GAS_PER_EXEC_ETH;
    const gasPerExecSource = measuredGasPerExec != null ? 'measured' : 'fallback';
    if (measuredGasPerExec != null) {
      console.log(`Gas per exec measured from receipts: ${measuredGasPerExec.toFixed(8)} ETH`);
    } else {
      console.log(`Gas per exec using fallback: ${FALLBACK_GAS_PER_EXEC_ETH} ETH`);
    }
    const dailyEthBurn = avgExecutionsPerDay * gasPerExecEth;
    const ethRunwayDays = dailyEthBurn > 0 ? Math.floor(ownerBalanceNum / dailyEthBurn) : null;

    // Slippage + price impact distributions from the last 30 days of executions
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    let slippageStats = null, priceImpactStats = null;
    try {
      const { data: impactRows } = await supabase
        .from('price_impact_cache')
        .select('price_impact,slippage_percent,timestamp')
        .gte('created_at', thirtyDaysAgoIso);

      if (impactRows && impactRows.length > 0) {
        const slipVals = impactRows.map(r => parseFloat(r.slippage_percent)).filter(v => isFinite(v)).sort((a, b) => a - b);
        const impactVals = impactRows.map(r => parseFloat(r.price_impact)).filter(v => isFinite(v)).sort((a, b) => a - b);

        if (slipVals.length > 0) {
          const sum = slipVals.reduce((s, v) => s + v, 0);
          slippageStats = {
            count: slipVals.length,
            mean: +(sum / slipVals.length).toFixed(3),
            p50: +percentile(slipVals, 50).toFixed(3),
            p95: +percentile(slipVals, 95).toFixed(3),
            min: +slipVals[0].toFixed(3),
            max: +slipVals[slipVals.length - 1].toFixed(3)
          };
        }
        if (impactVals.length > 0) {
          const sum = impactVals.reduce((s, v) => s + v, 0);
          priceImpactStats = {
            count: impactVals.length,
            mean: +(sum / impactVals.length).toFixed(4),
            p50: +percentile(impactVals, 50).toFixed(4),
            p95: +percentile(impactVals, 95).toFixed(4),
            min: +impactVals[0].toFixed(4),
            max: +impactVals[impactVals.length - 1].toFixed(4)
          };
        }
      }
    } catch (err) {
      console.error('Failed to compute slippage/impact stats:', err.message);
    }

    const visualizationData = {
      overview: {
        uniqueWallets: uniqueLifetimeWallets.size,
        activeWallets: uniqueActiveWallets.size,
        totalRegistrations,
        totalPurchasesExecuted,
        totalActiveSessions,
        totalCancelledSessions: destroyEvents.length,
        totalTokenPairs: tokenPairsArray.length,
        cancellationRate: totalRegistrations > 0
          ? +((destroyEvents.length / totalRegistrations) * 100).toFixed(1)
          : 0,
        totalUsdVolume,
        avgExecutionsPerDay: +avgExecutionsPerDay.toFixed(2),
        lastExecutionTimestamp,
        ethRunwayDays
      },
      sourceTokenVolumes,
      destinationTokenVolumes,
      activeSessionsByToken,
      buyTimeHistogram,
      slippageStats,
      priceImpactStats,
      revenue,
      treasury,
      symbolMap,
      dailyActivity: dailyActivityArray,
      tokenPairs: tokenPairsArray,
      metadata: {
        currentBlock,
        lastSyncedBlock,
        dataFetchedAt: new Date().toISOString(),
        contractAddress: CONTRACT_ADDRESS,
        ownerAddress,
        ownerBalance,
        ethPrice,
        avgGasPerExecEth: +gasPerExecEth.toFixed(8),
        gasPerExecSource,
        needsSync: lastSyncedBlock < currentBlock,
        blocksBehind: Math.max(0, currentBlock - lastSyncedBlock)
      }
    };

    console.log("Visualization data computed successfully");
    return res.status(200).json(visualizationData);

  } catch (error) {
    console.error("Error in get-visualization:", error);
    return res.status(500).json({ error: "Failed to fetch visualization data" });
  }
}
