import { supabase } from '../lib/supabase.js';


function roundToQuarterHour(buy_time) {
  const [h, m] = buy_time.split(":").map(Number);
  const rounded = Math.round(m / 15) * 15;
  const finalMin = rounded === 60 ? 0 : rounded;
  const finalHour = (rounded === 60 ? h + 1 : h) % 24;
  
  return `${String(finalHour).padStart(2, "0")}:${String(finalMin).padStart(2, "0")}`;
}


function validateDCAInput({ address, buy_time }) {
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

  return {
    address,
    buy_time: roundToQuarterHour(buy_time)
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    
    const validInput = validateDCAInput(req.body);

    const { error } = await supabase
      .from("dca_users")
      .upsert(validInput, { onConflict: ["address"] });

    if (error) {
      return res.status(400).json({ error: error.message || "Upsert failed" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid request" });
  }
}

