import { ethers } from "ethers";
import { getCachedEvents, updateCachedEvents } from "../lib/cache.js";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const START_BLOCK = 28400000;
const BATCH_SIZE = 10_000;
const RATE_LIMIT_DELAY = 200;
const EXPECTED_SCHEDULE_ID = process.env.UPSTASH_SYNC_CACHE_ID;
const SYNC_STATE_KEY = 'sync_state';

const CONTRACT_ABI = [
  "event PurchaseExecuted(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountIn, uint256 amountOut, uint256 daysLeft)"
];

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


async function syncPerUserCache(provider, contract) {
  const currentBlock = await provider.getBlockNumber();
  console.log(`[PER-USER CACHE SYNC] Current block: ${currentBlock}`);

  const syncState = await getCachedEvents(SYNC_STATE_KEY, 'purchase_history_cache');
  let fromBlock = START_BLOCK;

  if (syncState && syncState.lastQueriedBlock) {
    fromBlock = syncState.lastQueriedBlock + 1;
    console.log(`[PER-USER CACHE SYNC] Resuming from block ${fromBlock}`);
  } else {
    console.log(`[PER-USER CACHE SYNC] Starting fresh from block ${START_BLOCK}`);
  }

  if (fromBlock > currentBlock) {
    console.log(`[PER-USER CACHE SYNC] Already up to date`);
    return { newEvents: 0, updatedBuyers: 0, currentBlock };
  }

  const filter = contract.filters.PurchaseExecuted();
  let currentBatchSize = BATCH_SIZE;
  let currentFetchBlock = fromBlock;
  let newEvents = 0;
  const buyerEventsMap = new Map();

  while (currentFetchBlock <= currentBlock) {
    const endBlock = Math.min(currentFetchBlock + currentBatchSize - 1, currentBlock);

    try {
      const events = await contract.queryFilter(
        filter,
        currentFetchBlock,
        endBlock
      );

      const minimalEvents = events.map(e => extractEventData(e));
      newEvents += minimalEvents.length;

      for (const event of minimalEvents) {
        if (!buyerEventsMap.has(event.buyer)) {
          buyerEventsMap.set(event.buyer, []);
        }
        buyerEventsMap.get(event.buyer).push(event);
      }

      console.log(
        `[PER-USER CACHE SYNC] Blocks ${currentFetchBlock}-${endBlock}: +${minimalEvents.length} events ` +
        `(${buyerEventsMap.size} unique buyers)`
      );

      currentFetchBlock = endBlock + 1;

      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      if (error.message.includes('query returned more than') || error.message.includes('limit') || currentBatchSize > 1000) {
        currentBatchSize = Math.floor(currentBatchSize / 2);
        console.log(`[PER-USER CACHE SYNC] Reducing batch size to ${currentBatchSize}`);
        continue;
      }
      throw error;
    }
  }

  let updatedBuyers = 0;
  for (const [buyerAddress, newBuyerEvents] of buyerEventsMap.entries()) {
    try {
      const cached = await getCachedEvents(buyerAddress, 'purchase_history_cache');
      let existingEvents = [];

      if (cached && cached.events) {
        existingEvents = cached.events;
      }

      const allEvents = [...existingEvents, ...newBuyerEvents];
      const uniqueEvents = Array.from(
        new Map(allEvents.map(e => [e.txHash, e])).values()
      );

      uniqueEvents.sort((a, b) => a.blockNumber - b.blockNumber);

      await updateCachedEvents(
        buyerAddress,
        'purchase_history_cache',
        uniqueEvents,
        currentBlock
      );

      updatedBuyers++;
      console.log(
        `[PER-USER CACHE SYNC] Updated ${buyerAddress}: ` +
        `${existingEvents.length} existing + ${newBuyerEvents.length} new = ${uniqueEvents.length} total events`
      );
    } catch (error) {
      console.error(`[PER-USER CACHE SYNC] Failed to update buyer ${buyerAddress}:`, error.message);
    }
  }

  await updateCachedEvents(
    SYNC_STATE_KEY,
    'purchase_history_cache',
    [],
    currentBlock
  );

  console.log(
    `[PER-USER CACHE SYNC] Synced ${newEvents} new events for ${updatedBuyers} buyers, ` +
    `current block: ${currentBlock}`
  );

  return { newEvents, updatedBuyers, currentBlock };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const scheduleId = req.headers["upstash-schedule-id"];
    if (scheduleId !== EXPECTED_SCHEDULE_ID) {
      console.error("[PER-USER CACHE SYNC] Invalid or missing Upstash-Schedule-Id");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("[PER-USER CACHE SYNC] Starting per-user cache synchronization...");
    const startTime = Date.now();

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const result = await syncPerUserCache(provider, contract);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PER-USER CACHE SYNC] Completed in ${duration}s`);

    return res.status(200).json({
      success: true,
      ...result,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("[PER-USER CACHE SYNC] ERROR:", err.message);
    return res.status(500).json({
      error: "Per-user cache sync failed",
      message: err.message
    });
  }
}
