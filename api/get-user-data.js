import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { getCachedEvents } from "../lib/cache.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const RECENT_BLOCKS_WINDOW = 50000;
const CHUNK_SIZE = 10000;

const CONTRACT_ABI = [
  "event PurchaseExecuted(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountIn, uint256 amountOut, uint256 daysLeft)"
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const tokenInfoCache = new Map();

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
    console.error(`Failed to fetch token info for ${tokenAddress}:`, error.message);
    const info = { decimals: 18, symbol: 'UNKNOWN' };
    tokenInfoCache.set(normalizedAddress, info);
    return info;
  }
}

function extractEventData(event) {
  return {
    buyer: event.args.buyer.toLowerCase(),
    sourceToken: event.args.sourceToken.toLowerCase(),
    destinationToken: event.args.destinationToken.toLowerCase(),
    amountIn: event.args.amountIn.toString(),
    amountOut: event.args.amountOut.toString(),
    daysLeft: event.args.daysLeft.toString(),
    txHash: event.transactionHash,
    blockNumber: event.blockNumber
  };
}

async function fetchUserPurchaseEvents(contract, userAddress, provider) {
  const currentBlock = await provider.getBlockNumber();
  const normalizedAddress = userAddress.toLowerCase();

  const userCache = await getCachedEvents(normalizedAddress, 'purchase_history_cache');
  let cachedEvents = [];
  let lastCachedBlock = 0;

  if (userCache && userCache.events) {
    cachedEvents = userCache.events;
    lastCachedBlock = userCache.lastQueriedBlock || 0;
    console.log(`[USER REQUEST] Found ${cachedEvents.length} cached events for ${userAddress}`);
  }

  const fromBlock = Math.max(lastCachedBlock + 1, currentBlock - RECENT_BLOCKS_WINDOW);
  let recentEvents = [];

  if (fromBlock <= currentBlock) {
    console.log(`[USER REQUEST] Fetching recent events from block ${fromBlock} to ${currentBlock}`);
    const filter = contract.filters.PurchaseExecuted(userAddress);

    try {
      let currentFrom = fromBlock;
      while (currentFrom <= currentBlock) {
        const currentTo = Math.min(currentFrom + CHUNK_SIZE - 1, currentBlock);
        console.log(`[USER REQUEST] Fetching chunk ${currentFrom} to ${currentTo}`);

        const events = await contract.queryFilter(filter, currentFrom, currentTo);
        recentEvents.push(...events.map(e => extractEventData(e)));

        if (currentTo < currentBlock) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        currentFrom = currentTo + 1;
      }
      console.log(`[USER REQUEST] Found ${recentEvents.length} recent events`);
    } catch (error) {
      console.error(`[USER REQUEST] Error fetching recent events:`, error.message);
    }
  }

  const allEvents = [...cachedEvents, ...recentEvents];
  const uniqueEvents = Array.from(
    new Map(allEvents.map(e => [e.txHash, e])).values()
  );

  console.log(`[USER REQUEST] Total unique events: ${uniqueEvents.length}`);
  return uniqueEvents;
}

async function handlePurchaseHistory(address) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  const userEvents = await fetchUserPurchaseEvents(contract, address, provider);

  const uniqueTokens = new Set();
  userEvents.forEach(e => {
    uniqueTokens.add(e.sourceToken);
    uniqueTokens.add(e.destinationToken);
  });

  for (const addr of Array.from(uniqueTokens)) {
    await getTokenInfo(addr, provider);
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  const uniqueBlocks = [...new Set(userEvents.map(e => e.blockNumber))];
  const blockCache = new Map();

  for (let i = 0; i < uniqueBlocks.length; i++) {
    const blockNum = uniqueBlocks[i];
    try {
      const block = await provider.getBlock(blockNum);
      if (block) {
        blockCache.set(blockNum, block.timestamp);
      }

      if (i < uniqueBlocks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (error) {
      console.error(`Failed to fetch block ${blockNum}:`, error.message);
      blockCache.set(blockNum, Math.floor(Date.now() / 1000));
    }
  }

  const txHashes = userEvents.map(e => e.txHash.toLowerCase());
  let priceImpactMap = new Map();

  if (txHashes.length > 0) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data: priceImpacts, error: impactError } = await supabase
        .from('price_impact_cache')
        .select('tx_hash, price_impact, slippage_percent')
        .in('tx_hash', txHashes);

      if (!impactError && priceImpacts) {
        priceImpacts.forEach(impact => {
          priceImpactMap.set(impact.tx_hash.toLowerCase(), {
            priceImpact: impact.price_impact,
            slippagePercent: impact.slippage_percent
          });
        });
      }
    } catch (impactFetchErr) {
      console.error("Error fetching price impacts:", impactFetchErr.message);
    }
  }

  const formattedEvents = userEvents.map((event) => {
    const timestamp = blockCache.get(event.blockNumber) || Math.floor(Date.now() / 1000);
    const sourceInfo = tokenInfoCache.get(event.sourceToken) || { decimals: 18, symbol: 'UNKNOWN' };
    const destInfo = tokenInfoCache.get(event.destinationToken) || { decimals: 18, symbol: 'UNKNOWN' };
    const impactData = priceImpactMap.get(event.txHash.toLowerCase());

    return {
      amountIn: ethers.formatUnits(event.amountIn, sourceInfo.decimals),
      amountOut: ethers.formatUnits(event.amountOut, destInfo.decimals),
      sourceToken: sourceInfo.symbol,
      destinationToken: destInfo.symbol,
      txHash: event.txHash,
      timestamp: timestamp,
      datetime: new Date(timestamp * 1000).toISOString(),
      priceImpact: impactData?.priceImpact !== null && impactData?.priceImpact !== undefined ? impactData.priceImpact : null,
      slippagePercent: impactData?.slippagePercent !== null && impactData?.slippagePercent !== undefined ? impactData.slippagePercent : null
    };
  });

  formattedEvents.sort((a, b) => b.timestamp - a.timestamp);

  return formattedEvents;
}

async function handleROIMetrics(address) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const normalizedAddress = address.toLowerCase();

  // Fetch all DCA sessions with price tracking for this user
  const { data: sessions, error: sessionsError } = await supabase
    .from('dca_session_prices')
    .select('*')
    .eq('buyer_address', normalizedAddress)
    .order('registration_timestamp', { ascending: false });

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    throw new Error('Failed to fetch ROI data');
  }

  if (!sessions || sessions.length === 0) {
    return {
      sessions: [],
      summary: {
        totalSessions: 0,
        completedSessions: 0,
        activeSessions: 0,
        totalROI: 0,
        averageROI: 0,
        bestROI: null,
        worstROI: null,
        totalTokensEarned: 0,
        totalInvested: 0
      }
    };
  }

  // Fetch all purchase executions for these sessions
  const { data: purchases, error: purchasesError } = await supabase
    .from('price_impact_cache')
    .select('*')
    .eq('buyer', normalizedAddress);

  if (purchasesError) {
    console.error('Error fetching purchases:', purchasesError);
    throw new Error('Failed to fetch purchase data');
  }

  // Initialize provider to fetch token decimals
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Collect all unique token addresses from sessions
  const uniqueTokens = new Set();
  sessions.forEach(session => {
    uniqueTokens.add(session.source_token.toLowerCase());
    uniqueTokens.add(session.destination_token.toLowerCase());
  });

  // Fetch token info for all tokens
  for (const tokenAddress of uniqueTokens) {
    await getTokenInfo(tokenAddress, provider);
  }

  // Don't pre-group purchases - we'll match them to sessions individually based on timestamp
  console.log('[ROI] Total purchases fetched:', purchases?.length || 0);

  // Calculate ROI for each session
  const enrichedSessions = sessions.map(session => {
    const sessionKey = `${session.source_token.toLowerCase()}-${session.destination_token.toLowerCase()}`;

    // Get token decimals from cache
    const sourceTokenInfo = tokenInfoCache.get(session.source_token.toLowerCase()) || { decimals: 18, symbol: 'UNKNOWN' };
    const destTokenInfo = tokenInfoCache.get(session.destination_token.toLowerCase()) || { decimals: 18, symbol: 'UNKNOWN' };

    // Match purchases to THIS specific session based on:
    // 1. Token pair match
    // 2. Purchase timestamp >= session registration timestamp
    // 3. Purchase timestamp < next session registration timestamp (if exists)
    const sessionRegistrationTime = session.registration_timestamp;

    // Find the next session with the same token pair (if any)
    const nextSession = sessions.find(s =>
      s.source_token.toLowerCase() === session.source_token.toLowerCase() &&
      s.destination_token.toLowerCase() === session.destination_token.toLowerCase() &&
      s.registration_timestamp > sessionRegistrationTime
    );
    const nextSessionTime = nextSession ? nextSession.registration_timestamp : Infinity;

    // Filter purchases that belong to THIS session only
    const sessionPurchases = purchases?.filter(p =>
      p.source_token.toLowerCase() === session.source_token.toLowerCase() &&
      p.destination_token.toLowerCase() === session.destination_token.toLowerCase() &&
      p.timestamp &&
      p.timestamp >= sessionRegistrationTime &&
      p.timestamp < nextSessionTime
    ) || [];

    console.log(`[ROI] Session ${sessionKey} (registered: ${sessionRegistrationTime}):`, {
      totalPurchases: sessionPurchases.length,
      registrationTimestamp: sessionRegistrationTime,
      nextSessionTimestamp: nextSession ? nextSessionTime : 'none',
      hasRegistrationPrice: !!session.registration_expected_amount_out
    });

    // STRICT: Only use purchases with valid timestamp data (already filtered above)
    const relevantPurchases = sessionPurchases.filter(p => {
      if (!p.timestamp) {
        console.warn(`[ROI] Purchase ${p.tx_hash} missing timestamp - excluding from ROI calculation`);
        return false;
      }
      return true;
    });

    console.log(`[ROI] Session ${sessionKey} relevant purchases:`, relevantPurchases.length);
    if (relevantPurchases.length > 0) {
      console.log(`[ROI] First purchase timestamps:`, relevantPurchases.slice(0, 2).map(p => ({
        timestamp: p.timestamp,
        tx_hash: p.tx_hash
      })));
    }

    // STRICT VALIDATION: Check if registration price data exists
    const hasValidRegistrationData = session.registration_expected_amount_out &&
                                      session.registration_expected_amount_out !== '0';

    if (!hasValidRegistrationData) {
      return {
        ...session,
        dataQuality: 'insufficient',
        roiAvailable: false,
        reason: 'Registration price data missing - session created before ROI tracking was enabled',
        purchasesExecuted: relevantPurchases.length,
        expectedPurchases: session.total_days,
        status: session.session_status || 'unknown',
        validPurchasesCount: 0,
        invalidPurchasesCount: relevantPurchases.length,
        totalTokensReceived: '0',
        lumpSumTokens: '0',
        tokensDifference: '0',
        roiPercentage: null,
        totalInvested: '0',
        expectedInvestment: session.registration_amount_in,
        volatility: null,
        firstPurchaseTimestamp: null,
        lastPurchaseTimestamp: null,
        completionPercentage: ((relevantPurchases.length / session.total_days) * 100).toFixed(1),
        // Token metadata
        sourceTokenDecimals: sourceTokenInfo.decimals,
        sourceTokenSymbol: sourceTokenInfo.symbol,
        destinationTokenDecimals: destTokenInfo.decimals,
        destinationTokenSymbol: destTokenInfo.symbol
      };
    }

    // Validate purchases have required data
    const invalidPurchases = relevantPurchases.filter(p =>
      !p.amount_out || p.amount_out === '0' ||
      !p.amount_in || p.amount_in === '0'
    );

    // Only use purchases with valid data (NO FALLBACKS)
    const validPurchases = relevantPurchases.filter(p =>
      p.amount_out && p.amount_out !== '0' &&
      p.amount_in && p.amount_in !== '0'
    );

    if (invalidPurchases.length > 0) {
      console.warn(`[ROI] Session ${sessionKey} has ${invalidPurchases.length} invalid purchases out of ${relevantPurchases.length} total`);
      console.warn(`[ROI] Invalid purchase examples:`, invalidPurchases.slice(0, 2).map(p => ({
        tx_hash: p.tx_hash,
        amount_in: p.amount_in,
        amount_out: p.amount_out,
        timestamp: p.timestamp
      })));
    }

    console.log(`[ROI] Session ${sessionKey} validation:`, {
      relevantPurchases: relevantPurchases.length,
      validPurchases: validPurchases.length,
      invalidPurchases: invalidPurchases.length
    });

    // Calculate actual tokens received through DCA (NO FALLBACKS - will throw if invalid)
    let totalTokensReceived = 0n;
    let totalActualInvestment = 0n;

    try {
      totalTokensReceived = validPurchases.reduce((sum, p) =>
        sum + BigInt(p.amount_out),
        0n
      );

      totalActualInvestment = validPurchases.reduce((sum, p) =>
        sum + BigInt(p.amount_in),
        0n
      );
    } catch (err) {
      console.error(`[ROI] Error calculating totals for session ${sessionKey}:`, err.message);
      return {
        ...session,
        dataQuality: 'error',
        roiAvailable: false,
        reason: `Calculation error: ${err.message}`,
        purchasesExecuted: relevantPurchases.length,
        expectedPurchases: session.total_days,
        status: session.session_status || 'unknown',
        validPurchasesCount: validPurchases.length,
        invalidPurchasesCount: invalidPurchases.length,
        totalTokensReceived: '0',
        lumpSumTokens: '0',
        tokensDifference: '0',
        roiPercentage: null,
        totalInvested: '0',
        expectedInvestment: session.registration_amount_in,
        volatility: null,
        firstPurchaseTimestamp: null,
        lastPurchaseTimestamp: null,
        completionPercentage: ((relevantPurchases.length / session.total_days) * 100).toFixed(1),
        // Token metadata
        sourceTokenDecimals: sourceTokenInfo.decimals,
        sourceTokenSymbol: sourceTokenInfo.symbol,
        destinationTokenDecimals: destTokenInfo.decimals,
        destinationTokenSymbol: destTokenInfo.symbol
      };
    }

    // Expected tokens if bought all at once (NO FALLBACK)
    const lumpSumTokens = BigInt(session.registration_expected_amount_out);

    // Calculate ROI percentage
    let roiPercentage = null;
    let tokensDifference = 0n;
    let roiAvailable = true;

    if (lumpSumTokens > 0n && validPurchases.length > 0) {
      tokensDifference = totalTokensReceived - lumpSumTokens;
      roiPercentage = Number(tokensDifference * 10000n / lumpSumTokens) / 100;
    } else if (validPurchases.length === 0) {
      roiAvailable = false;
    }

    // Determine session status
    const purchaseCount = validPurchases.length;
    const expectedPurchases = session.total_days;
    const isCompleted = purchaseCount >= expectedPurchases;
    const status = session.session_status === 'cancelled'
      ? 'cancelled'
      : isCompleted
        ? 'completed'
        : 'active';

    // Calculate price volatility (only from valid purchases)
    const executionRates = validPurchases
      .filter(p => p.exchange_rate && p.exchange_rate > 0)
      .map(p => Number(p.exchange_rate));

    const volatility = executionRates.length > 1
      ? {
          min: Math.min(...executionRates),
          max: Math.max(...executionRates),
          avg: executionRates.reduce((a, b) => a + b, 0) / executionRates.length,
          range: ((Math.max(...executionRates) - Math.min(...executionRates)) / Math.min(...executionRates) * 100).toFixed(2)
        }
      : null;

    // Timestamps (strict - no fallback)
    const purchaseTimestamps = validPurchases
      .map(p => p.timestamp)
      .filter(t => t && t > 0);

    return {
      ...session,
      // Data quality indicators
      dataQuality: 'complete',
      roiAvailable,
      validPurchasesCount: validPurchases.length,
      invalidPurchasesCount: invalidPurchases.length,

      // Calculated metrics
      purchasesExecuted: relevantPurchases.length,
      expectedPurchases,
      completionPercentage: (purchaseCount / expectedPurchases * 100).toFixed(1),
      status,

      // ROI metrics
      totalTokensReceived: totalTokensReceived.toString(),
      lumpSumTokens: lumpSumTokens.toString(),
      tokensDifference: tokensDifference.toString(),
      roiPercentage: roiPercentage !== null ? roiPercentage.toFixed(2) : null,

      // Investment tracking
      totalInvested: totalActualInvestment.toString(),
      expectedInvestment: session.registration_amount_in,

      // Price volatility
      volatility,

      // Execution details (null if no valid purchases with timestamps)
      firstPurchaseTimestamp: purchaseTimestamps.length > 0
        ? Math.min(...purchaseTimestamps)
        : null,
      lastPurchaseTimestamp: purchaseTimestamps.length > 0
        ? Math.max(...purchaseTimestamps)
        : null,

      // Token metadata
      sourceTokenDecimals: sourceTokenInfo.decimals,
      sourceTokenSymbol: sourceTokenInfo.symbol,
      destinationTokenDecimals: destTokenInfo.decimals,
      destinationTokenSymbol: destTokenInfo.symbol
    };
  });

  // Calculate summary statistics (ONLY from sessions with valid ROI data)
  const completedSessions = enrichedSessions.filter(s => s.status === 'completed');
  const activeSessions = enrichedSessions.filter(s => s.status === 'active');
  const sessionsWithROI = completedSessions.filter(s => s.roiAvailable && s.roiPercentage !== null);
  const sessionsWithoutROI = enrichedSessions.filter(s => !s.roiAvailable);

  const roiValues = sessionsWithROI
    .map(s => parseFloat(s.roiPercentage))
    .filter(v => !isNaN(v));

  const totalTokensEarned = sessionsWithROI.reduce((sum, s) =>
    sum + BigInt(s.tokensDifference),
    0n
  );

  const totalInvested = sessionsWithROI.reduce((sum, s) =>
    sum + BigInt(s.totalInvested),
    0n
  );

  const summary = {
    totalSessions: enrichedSessions.length,
    completedSessions: completedSessions.length,
    activeSessions: activeSessions.length,
    cancelledSessions: enrichedSessions.filter(s => s.status === 'cancelled').length,

    // Data quality metrics
    sessionsWithROI: sessionsWithROI.length,
    sessionsWithoutROI: sessionsWithoutROI.length,
    dataQualityRate: enrichedSessions.length > 0
      ? ((sessionsWithROI.length / enrichedSessions.length) * 100).toFixed(1)
      : '0.0',

    // ROI statistics (only from valid sessions)
    totalROI: roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0).toFixed(2) : null,
    averageROI: roiValues.length > 0
      ? (roiValues.reduce((a, b) => a + b, 0) / roiValues.length).toFixed(2)
      : null,
    bestROI: roiValues.length > 0
      ? Math.max(...roiValues).toFixed(2)
      : null,
    worstROI: roiValues.length > 0
      ? Math.min(...roiValues).toFixed(2)
      : null,

    // Token metrics
    totalTokensEarned: totalTokensEarned.toString(),
    totalInvested: totalInvested.toString(),

    // Win rate (only from sessions with valid ROI)
    winningSessionsCount: roiValues.filter(v => v > 0).length,
    losingSessionsCount: roiValues.filter(v => v < 0).length,
    neutralSessionsCount: roiValues.filter(v => v === 0).length,
    winRate: roiValues.length > 0
      ? (roiValues.filter(v => v > 0).length / roiValues.length * 100).toFixed(1)
      : null
  };

  return {
    sessions: enrichedSessions,
    summary
  };
}

/**
 * Combined endpoint for user-specific data
 * - type=purchase-history: Returns purchase history
 * - type=roi-metrics: Returns ROI performance metrics
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { address, type = 'purchase-history' } = req.query;

    if (!address) {
      return res.status(400).json({ error: "Address parameter required" });
    }

    if (type === 'roi-metrics') {
      const data = await handleROIMetrics(address);
      return res.status(200).json(data);
    } else if (type === 'purchase-history') {
      const data = await handlePurchaseHistory(address);
      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: "Invalid type parameter. Use 'purchase-history' or 'roi-metrics'" });
    }

  } catch (error) {
    console.error("Error in get-user-data:", error);
    return res.status(500).json({
      error: "Failed to fetch user data",
      details: error.message
    });
  }
}
