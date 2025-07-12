import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../lib/constants.js";
import { signer } from "../lib/provider.js";
import { supabase } from "../lib/supabase.js";
import launchDCA from "./run-dca.js";



function getCurrentTimeSlot() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    const dcaUsers = await contract.getRegisteredBuyers();

    if (!dcaUsers.length) {
      console.log("[CRON] No registered buyers found");
      return res.status(200).json({ matched: [] });
    }

    const currentSlot = getCurrentTimeSlot();

    const { data: users, error } = await supabase
      .from("dca_users")
      .select("*")
      .in("address", dcaUsers)
      .eq("buy_time", currentSlot);

    if (error) throw error;

    console.log(`[CRON] ${users.length} buyers matched for ${currentSlot}`);
    if (users.length === 0) {
      return res.status(200).json({ matched: [] });
    }
    await launchDCA(contract, users.map(u => u.address));

    return res.status(200).json({ matched: users });
    
  } catch (err) {
    console.error("CRON ERROR:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
