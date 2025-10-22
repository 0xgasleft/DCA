import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../lib/constants.js";
import { signer } from "../lib/provider.js";
import launchDCA from "./run-dca.js";

const EXPECTED_SCHEDULE_ID = process.env.UPSTASH_CHECK_BUYERS_ID;

function getCurrentTimeSlot() {
  const now = new Date();
  // Always use UTC time since buy_time is stored in UTC in the contract
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(Math.floor(now.getUTCMinutes() / 15) * 15).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const scheduleId = req.headers["upstash-schedule-id"];
    if (scheduleId !== EXPECTED_SCHEDULE_ID) {
      console.error("[CRON] Invalid or missing Upstash-Schedule-Id");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    const dcaUsers = await contract.getRegisteredBuyers();

    if (!dcaUsers.length) {
      console.log("[CRON] No registered buyers found");
      return res.status(200).json({ matched: [] });
    }

    const currentSlot = getCurrentTimeSlot();
    const currentSlotInt = parseInt(currentSlot.replace(":", ""));
    console.log(`[CRON] Checking for sessions scheduled at ${currentSlot} (${currentSlotInt})`);


    const sessions = [];

    for (const buyer of dcaUsers) {
      const destinationTokens = await contract.getUserDestinationTokens(buyer);

      for (const destinationToken of destinationTokens) {
        const config = await contract.getDCAConfig(buyer, destinationToken);

        if (Number(config.buy_time) === currentSlotInt && config.amount_per_day > 0) {
          console.log(`[CRON] Matched DCA session: ${buyer} -> ${destinationToken} at ${currentSlot}`);
          sessions.push({
            address: buyer,
            destination_token: destinationToken,
            source_token: config.sourceToken,
            buy_time: currentSlot,
            amount_per_day: config.amount_per_day.toString(),
            days_left: config.days_left.toString(),
            isNativeETH: config.isNativeETH
          });
        }
      }
    }

    if (sessions.length === 0) {
      return res.status(200).json({ matched: [] });
    }

    await launchDCA(contract, sessions);

    return res.status(200).json({ matched: sessions });

  } catch (err) {
    console.error("CRON ERROR:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
