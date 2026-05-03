import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l.includes("="))
    .map(l => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY);

const buyers = [
  "0xf8511574d0badae36e7f28eb3726e31c6b50e920",
  "0x0566aa0c72a83e3e72857dcc52ebcc7e481cc37f",
  "0x325f3e52bb8529352091a268f60750ba5a978cc4",
  "0xd4f6ae01d6a79595c872c25d302a4404b3923374",
  "0x66dc2cccd7fa6206617a8bdee3fb6dc21b848a3a",
  "0x2b375d7c4fd1906d683867aa6ea93a63b401db1e",
  "0x18ffe0ef3ab518d59e29d672fddef0d0131578a0",
  "0xec146fa8a4bf83b5ba21f1b6e3de654432cbc76f",
];

const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
console.log(`Cutoff: ${cutoff}`);
console.log(`Checking ${buyers.length} buyers...\n`);

const { data, error } = await supabase
  .from("dca_attempt_tracking")
  .select("buyer_address, source_token, destination_token, success, error_message, attempt_timestamp, retry_count, transaction_hash, price_impact, slippage_percent")
  .in("buyer_address", buyers)
  .gte("attempt_timestamp", cutoff)
  .order("attempt_timestamp", { ascending: false });

if (error) { console.error(error); process.exit(1); }

console.log(`Total attempts in last 7d for these buyers: ${data.length}`);
console.log(`Failed: ${data.filter(r => !r.success).length}`);
console.log(`Succeeded: ${data.filter(r => r.success).length}\n`);

// Group by buyer
const byBuyer = new Map();
for (const r of data) {
  const k = r.buyer_address.toLowerCase();
  if (!byBuyer.has(k)) byBuyer.set(k, []);
  byBuyer.get(k).push(r);
}

for (const [buyer, rows] of byBuyer.entries()) {
  console.log("=".repeat(120));
  console.log(`BUYER ${buyer}`);
  console.log("=".repeat(120));
  console.log(`Total: ${rows.length} | Success: ${rows.filter(r => r.success).length} | Fail: ${rows.filter(r => !r.success).length}`);
  for (const r of rows) {
    const flag = r.success ? "✓" : "✗";
    const ts = r.attempt_timestamp.replace("T", " ").slice(0, 19);
    const dest = r.destination_token.slice(0, 10);
    const src = r.source_token.slice(0, 10);
    const retries = r.retry_count > 0 ? ` r=${r.retry_count}` : "";
    const err = r.error_message ? ` | ${r.error_message.slice(0, 200).replace(/\s+/g, " ")}` : "";
    console.log(`  ${flag} ${ts} ${src}→${dest}${retries}${err}`);
  }
  console.log("");
}

// Aggregate failure modes
const failed = data.filter(r => !r.success);
const errorBuckets = new Map();
for (const r of failed) {
  const msg = r.error_message || "(no message)";
  // Bucketize
  let bucket;
  if (/relay step failed/i.test(msg)) bucket = "Relay step failed (on-chain revert)";
  else if (/failed to get relay execution quote/i.test(msg)) bucket = "Failed to get Relay execution quote";
  else if (/failed to get relay quote/i.test(msg)) bucket = "Failed to get Relay quote";
  else if (/computeDynamicSlippageBps/i.test(msg)) bucket = "computeDynamicSlippageBps not defined";
  else if (/no swap routes/i.test(msg)) bucket = "NO_SWAP_ROUTES_FOUND";
  else if (/insufficient/i.test(msg)) bucket = "Insufficient (allowance/balance)";
  else if (/slippage/i.test(msg)) bucket = "Slippage error";
  else bucket = msg.slice(0, 80);
  errorBuckets.set(bucket, (errorBuckets.get(bucket) || 0) + 1);
}

console.log("=".repeat(80));
console.log("FAILURE MODE BREAKDOWN (these buyers, last 7d)");
console.log("=".repeat(80));
for (const [bucket, count] of [...errorBuckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}x  ${bucket}`);
}
