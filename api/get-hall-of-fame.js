import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_VISUALIZE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
    console.error(`Failed to get token info for ${tokenAddress}:`, error);
    return { decimals: 18, symbol: 'UNKNOWN' };
  }
}


async function getEthPrice() {
  try {
    
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    return data.ethereum?.usd;
  } catch (error) {
    console.error('Failed to fetch ETH price:', error);
    return null;
  }
}

function calculateScore(userData, ethPrice) {
  let totalUsdVolume = 0;

  for (const token of userData.tokens) {
    const tokenVolume = parseFloat(token.volume);

    if (token.symbol === 'USDT' || token.symbol === 'USDC' || token.symbol === 'DAI' ||
        token.symbol === 'USDT0' || token.symbol.includes('USD')) {
      totalUsdVolume += tokenVolume;
    }
    else if (token.symbol === 'ETH' || token.symbol === 'WETH') {
      totalUsdVolume += tokenVolume * ethPrice;
    }
    else {
      throw new Error(`Unsupported token for volume calculation: ${token.symbol}`);
    }
  }



  
  
  const volumeScore = Math.sqrt(totalUsdVolume) * 10;

  const completionRate = userData.totalDaysPlanned > 0
    ? userData.purchasesExecuted / userData.totalDaysPlanned
    : 0;

  const cancellationPenalty = userData.totalRegistrations > 0
    ? (userData.cancellations / userData.totalRegistrations) * 0.5
    : 0;

  const consistencyScore = completionRate * 100 * (1 - cancellationPenalty);

  const diversityScore = Math.min((userData.uniqueDestinationTokens + userData.uniqueSourceTokens) * 5, 50);

  const avgDaysPerSession = userData.totalRegistrations > 0
    ? userData.totalDaysPlanned / userData.totalRegistrations
    : 0;

  const commitmentScore = Math.min(avgDaysPerSession * 2, 50);

  
  
  let completionMultiplier = 0;
  if (completionRate >= 0.8) {
    completionMultiplier = 0.5; 
  } else if (completionRate >= 0.6) {
    completionMultiplier = 0.25; 
  } else if (completionRate >= 0.4) {
    completionMultiplier = 0; 
  } else if (completionRate >= 0.2) {
    completionMultiplier = -0.3; 
  } else {
    completionMultiplier = -0.5; 
  }

  const completionAdjustment = volumeScore * completionMultiplier;

  const totalScore =
    volumeScore +
    (consistencyScore * 0.1) +
    (diversityScore * 0.15) +
    (commitmentScore * 0.1) +
    completionAdjustment;

  
  const finalScore = Math.max(0, totalScore);

  return {
    totalScore: Math.round(finalScore * 100) / 100,
    breakdown: {
      volumeScore: Math.round(volumeScore * 100) / 100,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      diversityScore: Math.round(diversityScore * 100) / 100,
      commitmentScore: Math.round(commitmentScore * 100) / 100
    },
    metrics: {
      totalUsdVolume: Math.round(totalUsdVolume * 100) / 100,
      completionRate: Math.round(completionRate * 100),
      cancellationPenalty: Math.round(cancellationPenalty * 100),
      avgDaysPerSession: Math.round(avgDaysPerSession * 10) / 10
    }
  };
}

function getTierInfo(score) {
  if (score >= 1000) return { tier: 'Legend', color: 'gold' };
  if (score >= 400) return { tier: 'Expert', color: 'expert' };
  if (score >= 250) return { tier: 'Professional', color: 'professional' };
  if (score >= 100) return { tier: 'Confirmed', color: 'confirmed' };
  if (score >= 10) return { tier: 'Rookie', color: 'rookie' };
  return { tier: 'Beginner', color: 'beginner' };
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

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Fetching Hall of Fame data (public access)...");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const ethPrice = await getEthPrice();
    console.log(`ETH Price: $${ethPrice}`);

    const { data: cacheData, error: cacheError } = await supabase
      .from("visualization_cache")
      .select("*")
      .eq("id", "global")
      .single();

    if (cacheError || !cacheData) {
      return res.status(500).json({ error: "Failed to fetch cache data" });
    }

    const registrationEvents = cacheData.registration_events || [];
    const purchaseEvents = cacheData.purchase_events || [];
    const destroyEvents = cacheData.destroy_events || [];

    console.log(`Processing ${registrationEvents.length} registrations, ${purchaseEvents.length} purchases, ${destroyEvents.length} cancellations`);

    const usersMap = new Map();

    for (const event of registrationEvents) {
      const buyer = event.args.buyer.toLowerCase();
      const destinationToken = event.args.destinationToken.toLowerCase();
      const daysLeft = BigInt(event.args.daysLeft);

      if (!usersMap.has(buyer)) {
        usersMap.set(buyer, {
          address: buyer,
          totalRegistrations: 0,
          purchasesExecuted: 0,
          cancellations: 0,
          totalDaysPlanned: 0,
          uniqueDestinationTokens: new Set(),
          uniqueSourceTokens: new Set(),
          tokens: new Map()
        });
      }

      const userData = usersMap.get(buyer);
      userData.totalRegistrations++;
      userData.totalDaysPlanned += Number(daysLeft);
      userData.uniqueDestinationTokens.add(destinationToken);

      const sourceToken = event.args.sourceToken.toLowerCase();
      userData.uniqueSourceTokens.add(sourceToken);
    }

    for (const event of purchaseEvents) {
      const buyer = event.args.buyer.toLowerCase();
      const sourceToken = event.args.sourceToken.toLowerCase();
      const amountIn = BigInt(event.args.amountIn);

      if (!usersMap.has(buyer)) {
        usersMap.set(buyer, {
          address: buyer,
          totalRegistrations: 0,
          purchasesExecuted: 0,
          cancellations: 0,
          totalDaysPlanned: 0,
          uniqueDestinationTokens: new Set(),
          uniqueSourceTokens: new Set(),
          tokens: new Map()
        });
      }

      const userData = usersMap.get(buyer);
      userData.purchasesExecuted++;
      userData.uniqueSourceTokens.add(sourceToken);

      const sourceInfo = await getTokenInfo(sourceToken, provider);
      const volumeFormatted = parseFloat(ethers.formatUnits(amountIn, sourceInfo.decimals));

      const tokenKey = `${sourceInfo.symbol}|${sourceToken}`;
      if (!userData.tokens.has(tokenKey)) {
        userData.tokens.set(tokenKey, {
          symbol: sourceInfo.symbol,
          address: sourceToken,
          volume: 0
        });
      }
      const tokenData = userData.tokens.get(tokenKey);
      tokenData.volume += volumeFormatted;
    }

    for (const event of destroyEvents) {
      const buyer = event.args.buyer.toLowerCase();

      if (usersMap.has(buyer)) {
        usersMap.get(buyer).cancellations++;
      }
    }

    const rankings = [];

    for (const [address, userData] of usersMap.entries()) {

      const userDataForCalc = {
        address,
        totalRegistrations: userData.totalRegistrations,
        purchasesExecuted: userData.purchasesExecuted,
        cancellations: userData.cancellations,
        totalDaysPlanned: userData.totalDaysPlanned,
        uniqueDestinationTokens: userData.uniqueDestinationTokens.size,
        uniqueSourceTokens: userData.uniqueSourceTokens.size,
        tokens: Array.from(userData.tokens.values())
      };

      const scoreData = calculateScore(userDataForCalc, ethPrice);
      const tierInfo = getTierInfo(scoreData.totalScore);

      rankings.push({
        address,
        score: scoreData.totalScore,
        ...scoreData.breakdown,
        ...scoreData.metrics,
        ...tierInfo,
        stats: {
          totalRegistrations: userData.totalRegistrations,
          purchasesExecuted: userData.purchasesExecuted,
          cancellations: userData.cancellations,
          uniqueDestinationTokens: userData.uniqueDestinationTokens.size,
          uniqueSourceTokens: userData.uniqueSourceTokens.size,
          totalDaysPlanned: userData.totalDaysPlanned
        }
      });
    }

    rankings.sort((a, b) => b.score - a.score);

    rankings.forEach((user, index) => {
      user.rank = index + 1;
    });

    console.log(`Hall of Fame calculated for ${rankings.length} users`);

    return res.status(200).json({
      success: true,
      rankings,
      metadata: {
        totalUsers: rankings.length,
        ethPrice,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error in get-hall-of-fame:", error);
    return res.status(500).json({
      error: "Failed to calculate Hall of Fame",
      details: error.message
    });
  }
}
