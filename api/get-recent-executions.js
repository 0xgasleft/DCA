import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "../lib/rateLimit.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const TOKEN_META = {
  "0x0000000000000000000000000000000000000000": { symbol: "ETH", decimals: 18 },
  "0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98": { symbol: "kBTC", decimals: 8 },
  "0x0200c29006150606b650577bbe7b6248f58470c1": { symbol: "USDT0", decimals: 6 },
  "0x0606fc632ee812ba970af72f8489baaa443c4b98": { symbol: "ANITA", decimals: 18 },
};

function fmt(amount, decimals) {
  const val = Number(amount) / Math.pow(10, decimals);
  if (!isFinite(val) || val === 0) return "0";
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
  if (val >= 1_000) return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (val >= 1) return val.toFixed(4).replace(/\.?0+$/, "");
  if (val >= 0.001) return val.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  const places = Math.ceil(-Math.log10(val)) + 3;
  return val.toFixed(Math.min(places, 18)).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function timeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { allowed } = await rateLimit(getClientIp(req), 30, 60_000);
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from("price_impact_cache")
    .select("buyer, source_token, destination_token, amount_in, amount_out, timestamp, tx_hash")
    .not("timestamp", "is", null)
    .order("timestamp", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: "Failed to fetch executions" });

  const executions = (data || []).map((row) => {
    const src = TOKEN_META[row.source_token?.toLowerCase()] || { symbol: "?", decimals: 18 };
    const dst = TOKEN_META[row.destination_token?.toLowerCase()] || { symbol: "?", decimals: 18 };
    return {
      buyer: `${row.buyer.slice(0, 6)}...${row.buyer.slice(-4)}`,
      sourceSymbol: src.symbol,
      destinationSymbol: dst.symbol,
      amountIn: fmt(row.amount_in, src.decimals),
      amountOut: fmt(row.amount_out, dst.decimals),
      timestamp: row.timestamp,
      timeAgo: timeAgo(row.timestamp),
      txHash: row.tx_hash,
    };
  });

  res.setHeader("Cache-Control", "s-maxage=25, stale-while-revalidate=5");
  return res.status(200).json({ executions });
}