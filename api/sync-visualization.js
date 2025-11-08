import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_VISUALIZE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const VISUALIZER_PASSWORD = "VizPass157@";
const CHUNK_SIZE = 5000;
const START_BLOCK = 28_000_000;
const MAX_BLOCKS_PER_REQUEST = 20000; // Limit to avoid timeout

const CONTRACT_ABI = [
  "event RegisteredDCASession(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountPerDay, uint256 daysLeft, uint256 buyTime, bool isNativeETH)",
  "event PurchaseExecuted(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountIn, uint256 amountOut, uint256 daysLeft)",
  "event DestroyedDCASession(address indexed buyer, uint256 amountRefunded)"
];

async function fetchEventsInChunks(contract, eventName, fromBlock, toBlock) {
  const allEvents = [];
  let currentFrom = fromBlock;

  while (currentFrom <= toBlock) {
    const currentTo = Math.min(currentFrom + CHUNK_SIZE - 1, toBlock);

    console.log(`Fetching ${eventName} from ${currentFrom} to ${currentTo}`);

    try {
      const events = await contract.queryFilter(eventName, currentFrom, currentTo);
      allEvents.push(...events);

      await new Promise(resolve => setTimeout(resolve, 500));

      currentFrom = currentTo + 1;
    } catch (error) {
      console.error(`Error fetching ${eventName} chunk ${currentFrom}-${currentTo}:`, error);

      if (error.message.includes("rate limit") || error.message.includes("429") || error.message.includes("Batch of more than 3")) {
        console.log("Rate limit or batch limit hit, waiting 3 seconds...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      throw error;
    }
  }

  return allEvents;
}

function serializeEvent(event) {
  return {
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
    args: {
      buyer: event.args.buyer,
      sourceToken: event.args.sourceToken,
      destinationToken: event.args.destinationToken,
      amountPerDay: event.args.amountPerDay?.toString(),
      daysLeft: event.args.daysLeft?.toString(),
      buyTime: event.args.buyTime?.toString(),
      isNativeETH: event.args.isNativeETH,
      amountIn: event.args.amountIn?.toString(),
      amountOut: event.args.amountOut?.toString(),
      amountRefunded: event.args.amountRefunded?.toString()
    }
  };
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

    console.log("Fetching visualization cache...");

    const { data: cacheData, error: cacheError } = await supabase
      .from("visualization_cache")
      .select("*")
      .eq("id", "global")
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error("Error fetching cache:", cacheError);
      return res.status(500).json({ error: "Failed to fetch cache", details: cacheError.message });
    }

    const currentBlock = await provider.getBlockNumber();
    const lastSyncedBlock = cacheData?.last_synced_block || START_BLOCK;

    console.log(`Current block: ${currentBlock}, Last synced: ${lastSyncedBlock}`);

    let registrationEvents = cacheData?.registration_events || [];
    let purchaseEvents = cacheData?.purchase_events || [];
    let destroyEvents = cacheData?.destroy_events || [];

    if (lastSyncedBlock >= currentBlock) {
      return res.status(200).json({
        success: true,
        message: "Cache is already up to date",
        lastSyncedBlock,
        currentBlock
      });
    }

    // Limit blocks per request to avoid timeout
    const syncToBlock = Math.min(lastSyncedBlock + MAX_BLOCKS_PER_REQUEST, currentBlock);
    const blocksToSync = syncToBlock - lastSyncedBlock;

    console.log(`Syncing ${blocksToSync} blocks from ${lastSyncedBlock + 1} to ${syncToBlock}`);

    const newRegistrations = await fetchEventsInChunks(contract, "RegisteredDCASession", lastSyncedBlock + 1, syncToBlock);
    console.log(`Found ${newRegistrations.length} new registrations`);

    const newPurchases = await fetchEventsInChunks(contract, "PurchaseExecuted", lastSyncedBlock + 1, syncToBlock);
    console.log(`Found ${newPurchases.length} new purchases`);

    const newDestroys = await fetchEventsInChunks(contract, "DestroyedDCASession", lastSyncedBlock + 1, syncToBlock);
    console.log(`Found ${newDestroys.length} new cancellations`);

    registrationEvents = [...registrationEvents, ...newRegistrations.map(serializeEvent)];
    purchaseEvents = [...purchaseEvents, ...newPurchases.map(serializeEvent)];
    destroyEvents = [...destroyEvents, ...newDestroys.map(serializeEvent)];

    console.log("Updating cache...");
    const { error: updateError } = await supabase
      .from("visualization_cache")
      .upsert({
        id: "global",
        last_synced_block: syncToBlock,
        registration_events: registrationEvents,
        purchase_events: purchaseEvents,
        destroy_events: destroyEvents
      });

    if (updateError) {
      console.error("Error updating cache:", updateError);
      return res.status(500).json({ error: "Failed to update cache", details: updateError.message });
    }

    const needsMoreSync = syncToBlock < currentBlock;
    const remainingBlocks = needsMoreSync ? currentBlock - syncToBlock : 0;

    console.log("Cache updated successfully");
    return res.status(200).json({
      success: true,
      message: needsMoreSync ? "Partial sync completed, more blocks remaining" : "Sync completed",
      lastSyncedBlock: syncToBlock,
      currentBlock,
      blocksSynced: blocksToSync,
      remainingBlocks,
      needsMoreSync,
      eventsFound: {
        registrations: newRegistrations.length,
        purchases: newPurchases.length,
        cancellations: newDestroys.length
      }
    });

  } catch (error) {
    console.error("Error in sync-visualization:", error);
    return res.status(500).json({
      error: "Failed to sync visualization data",
      details: error.message
    });
  }
}
