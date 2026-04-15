import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "../lib/rateLimit.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { allowed } = await rateLimit(getClientIp(req), 20, 60_000);
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const { source, destination } = req.query;
  if (!source || !destination) {
    return res.status(400).json({ error: "source and destination query params required" });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(source) || !/^0x[a-fA-F0-9]{40}$/.test(destination)) {
    return res.status(400).json({ error: "Invalid token address format" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from("price_impact_cache")
    .select("timestamp, exchange_rate")
    .eq("source_token", source.toLowerCase())
    .eq("destination_token", destination.toLowerCase())
    .not("timestamp", "is", null)
    .not("exchange_rate", "is", null)
    .gt("exchange_rate", 0);

  if (error) return res.status(500).json({ error: "Failed to fetch data" });

  if (!data || data.length < 10) {
    return res.status(200).json({
      insufficient_data: true,
      sample_size: data?.length || 0,
      message: "Not enough executions yet to determine a best time"
    });
  }

  // Group executions by calendar date, compute per-date daily avg
  // Then measure each execution's relative performance vs its own day's avg.
  // This removes price drift over time and isolates the time-of-day signal.
  const byDate = new Map();
  for (const row of data) {
    const rate = parseFloat(row.exchange_rate);
    if (!isFinite(rate) || rate <= 0) continue;
    const date = new Date(row.timestamp * 1000).toISOString().split("T")[0];
    const hour = new Date(row.timestamp * 1000).getUTCHours();
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ hour, rate });
  }

  // For each day with at least 2 data points, normalize each execution against daily avg
  const hourlyRelative = new Map(); // hour -> array of relative performances
  for (const [, rows] of byDate.entries()) {
    if (rows.length < 2) continue;
    const dayAvg = rows.reduce((s, r) => s + r.rate, 0) / rows.length;
    for (const { hour, rate } of rows) {
      if (!hourlyRelative.has(hour)) hourlyRelative.set(hour, []);
      hourlyRelative.get(hour).push(rate / dayAvg);
    }
  }

  const hours = Array.from(hourlyRelative.entries())
    .filter(([, perfs]) => perfs.length >= 2)
    .map(([hour, perfs]) => {
      const avg = perfs.reduce((s, p) => s + p, 0) / perfs.length;
      return {
        hour,
        avgRelativePerformance: avg,
        // pct above/below neutral (1.0)
        performancePct: ((avg - 1) * 100).toFixed(2),
        sampleSize: perfs.length,
        label: `${String(hour).padStart(2, "0")}:00 UTC`
      };
    })
    .sort((a, b) => b.avgRelativePerformance - a.avgRelativePerformance);

  if (hours.length === 0) {
    return res.status(200).json({
      insufficient_data: true,
      sample_size: data.length,
      message: "Not enough per-hour data yet"
    });
  }

  const best = hours[0];
  const worst = hours[hours.length - 1];
  const improvementPct = (
    (best.avgRelativePerformance - worst.avgRelativePerformance) * 100
  ).toFixed(2);

  return res.status(200).json({
    insufficient_data: false,
    sample_size: data.length,
    best_hours: hours.slice(0, 3),
    worst_hours: hours.slice(-3).reverse(),
    improvement_potential: improvementPct,
  });
}