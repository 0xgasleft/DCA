import { ethers } from "ethers";
import { getCachedEvents } from "../lib/cache.js";

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


export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { address } = req.query;

    if (!address) {
      return res.status(400).json({ error: "Address parameter required" });
    }

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
        const { createClient } = await import("@supabase/supabase-js");
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
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

    return res.status(200).json(formattedEvents);

  } catch (err) {
    console.error("[API] Purchase history error:", err.message);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
