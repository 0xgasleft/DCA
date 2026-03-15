import { supabase } from '../lib/supabase.js';
import { fetchPriceImpact } from '../lib/priceImpact.js';
import { CONTRACT_ADDRESS } from '../lib/constants.js';

function roundToQuarterHour(buy_time) {
  const [h, m] = buy_time.split(":").map(Number);
  const rounded = Math.round(m / 15) * 15;
  const finalMin = rounded === 60 ? 0 : rounded;
  const finalHour = (rounded === 60 ? h + 1 : h) % 24;
  return `${String(finalHour).padStart(2, "0")}:${String(finalMin).padStart(2, "0")}`;
}

function validateDCAInput({ address, buy_time, source_token, destination_token, tx_hash, amount_per_day, days_left, block_number }) {
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

  if (!amount_per_day || !/^\d+$/.test(amount_per_day)) {
    throw new Error("Invalid amount_per_day");
  }

  if (!days_left || !/^\d+$/.test(days_left)) {
    throw new Error("Invalid days_left");
  }

  if (!block_number || !/^\d+$/.test(block_number)) {
    throw new Error("Invalid block_number");
  }

  return {
    address,
    buy_time: roundToQuarterHour(buy_time),
    source_token,
    destination_token,
    tx_hash,
    amount_per_day,
    days_left,
    block_number
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const validInput = validateDCAInput(req.body);

    try {
      const amountPerDay = BigInt(validInput.amount_per_day);
      const daysLeft = BigInt(validInput.days_left);
      const totalVolume = (amountPerDay * daysLeft).toString();

      const { error: statsError } = await supabase.rpc('increment_registration_stats', {
        p_source_token: validInput.source_token.toLowerCase(),
        p_destination_token: validInput.destination_token.toLowerCase(),
        p_volume_registered: totalVolume
      });

      if (statsError) {
        console.error('[STATS] Failed to update registration stats:', statsError.message);
      }

      try {
        console.log('[ROI] Fetching registration price for ROI tracking...');
        const priceData = await fetchPriceImpact(
          CONTRACT_ADDRESS,
          validInput.source_token,
          validInput.destination_token,
          totalVolume
        );

        if (priceData && !priceData.error && priceData.expectedOutput) {
          const exchangeRate = Number(priceData.expectedOutput) / Number(totalVolume);

          const { error: priceError } = await supabase
            .from('dca_session_prices')
            .insert({
              buyer_address: validInput.address.toLowerCase(),
              source_token: validInput.source_token.toLowerCase(),
              destination_token: validInput.destination_token.toLowerCase(),
              registration_tx_hash: validInput.tx_hash.toLowerCase(),
              registration_timestamp: Math.floor(Date.now() / 1000),
              registration_block_number: Number(validInput.block_number),
              registration_amount_in: totalVolume,
              registration_expected_amount_out: priceData.expectedOutput.toString(),
              registration_exchange_rate: exchangeRate,
              amount_per_day: amountPerDay.toString(),
              total_days: Number(daysLeft),
              registration_request_id: priceData.requestId || null,
              registration_quote_json: priceData.quote || null,
              session_status: 'active'
            });

          if (priceError) {
            console.error('[ROI] Failed to store registration price:', priceError.message);
          } else {
            console.log('[ROI] Registration price stored successfully for future ROI calculations');
            console.log(`[ROI] Exchange rate: ${exchangeRate} ${validInput.destination_token}/${validInput.source_token}`);
          }
        } else {
          console.warn('[ROI] Could not fetch registration price, ROI will not be available for this session');
        }
      } catch (roiErr) {
        console.error('[ROI] Error tracking registration price:', roiErr.message);
      }
    } catch (statsErr) {
      console.error('[STATS] Error:', statsErr.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid request" });
  }
}
