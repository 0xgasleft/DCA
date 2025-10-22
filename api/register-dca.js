import { supabase } from '../lib/supabase.js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../lib/constants.js';

function roundToQuarterHour(buy_time) {
  const [h, m] = buy_time.split(":").map(Number);
  const rounded = Math.round(m / 15) * 15;
  const finalMin = rounded === 60 ? 0 : rounded;
  const finalHour = (rounded === 60 ? h + 1 : h) % 24;

  return `${String(finalHour).padStart(2, "0")}:${String(finalMin).padStart(2, "0")}`;
}


function validateDCAInput({ address, buy_time, source_token, destination_token, tx_hash }) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid address");
  }

  if (!/^\d{2}:\d{2}$/.test(buy_time)) {
    throw new Error("Invalid buy_time format (expected HH:MM)");
  }

  const [hour, minute] = buy_time.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new Error("Invalid time value in buy_time");
  }

  if (!source_token || !/^0x[a-fA-F0-9]{40}$/.test(source_token)) {
    throw new Error("Invalid source_token");
  }

  if (!destination_token || !/^0x[a-fA-F0-9]{40}$/.test(destination_token)) {
    throw new Error("Invalid destination_token");
  }

  if (!tx_hash || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
    throw new Error("Invalid tx_hash");
  }

  return {
    address,
    buy_time: roundToQuarterHour(buy_time),
    source_token,
    destination_token,
    tx_hash
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const validInput = validateDCAInput(req.body);

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const receipt = await provider.getTransactionReceipt(validInput.tx_hash);

      if (!receipt) {
        console.error('[STATS] Transaction receipt not found for', validInput.tx_hash);
        return res.status(200).json({ success: true });
      }

      const filter = contract.filters.RegisteredDCASession(validInput.address);
      const events = await contract.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);

      if (events.length > 0) {
        const event = events.find(e => e.transactionHash === validInput.tx_hash);

        if (!event) {
          console.error('[STATS] Event not found in transaction', validInput.tx_hash);
          return res.status(200).json({ success: true });
        }

        const { amountPerDay, daysLeft, sourceToken, destinationToken } = event.args;
        const totalVolume = (BigInt(amountPerDay) * BigInt(daysLeft)).toString();

        const { error: statsError } = await supabase.rpc('increment_registration_stats', {
          p_source_token: sourceToken.toLowerCase(),
          p_destination_token: destinationToken.toLowerCase(),
          p_volume_registered: totalVolume
        });

        if (statsError) {
          console.error('[STATS] Failed to update registration stats:', statsError.message);
        }
      } else {
        console.error('[STATS] No RegisteredDCASession event found in block', receipt.blockNumber);
      }
    } catch (statsErr) {
      console.error('[STATS] Error:', statsErr.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid request" });
  }
}

