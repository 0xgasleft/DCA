import { ethers } from "ethers";

const RPC = "https://rpc-gel.inkonchain.com";
const CONTRACT = "0x4286643d9612515F487c2F3272845bc53Ca80705";
const START_BLOCK = 28_000_000;

const ABI = [
  "function getRegisteredBuyers() view returns (address[])",
  "function getDCAConfig(address user, address destinationToken) view returns (tuple(address sourceToken, address destinationToken, uint256 amount_per_day, uint256 days_left, uint256 buy_time, bool isNativeETH))",
  "event RegisteredDCASession(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountPerDay, uint256 daysLeft, uint256 buyTime, bool isNativeETH)",
  "event PurchaseExecuted(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountIn, uint256 amountOut, uint256 daysLeft)",
];

const ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];

const symbolCache = new Map();
async function symbolFor(provider, addr) {
  const k = addr.toLowerCase();
  if (symbolCache.has(k)) return symbolCache.get(k);
  if (k === "0x0000000000000000000000000000000000000000") { symbolCache.set(k, "ETH"); return "ETH"; }
  try {
    const c = new ethers.Contract(addr, ERC20, provider);
    const s = await c.symbol();
    symbolCache.set(k, s);
    return s;
  } catch { symbolCache.set(k, "?"); return "?"; }
}

async function fetchLogsRanged(provider, filter, fromBlock, toBlock, span = 50_000) {
  const out = [];
  for (let from = fromBlock; from <= toBlock; from += span) {
    const to = Math.min(from + span - 1, toBlock);
    try {
      const logs = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
      out.push(...logs);
    } catch (e) {
      // shrink and retry
      const half = Math.floor(span / 2);
      if (half < 500) throw e;
      console.error(`getLogs ${from}-${to} failed (${e.message}), narrowing to ${half}-block windows`);
      const sub = await fetchLogsRanged(provider, filter, from, to, half);
      out.push(...sub);
    }
  }
  return out;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const contract = new ethers.Contract(CONTRACT, ABI, provider);

  const head = await provider.getBlockNumber();
  console.log(`Head block: ${head}`);
  console.log(`Scanning from ${START_BLOCK} → ${head}`);

  const iface = new ethers.Interface(ABI);
  const regTopic = iface.getEvent("RegisteredDCASession").topicHash;
  const purTopic = iface.getEvent("PurchaseExecuted").topicHash;

  console.log("Fetching RegisteredDCASession events...");
  const regLogs = await fetchLogsRanged(provider, { address: CONTRACT, topics: [regTopic] }, START_BLOCK, head);
  console.log(`  ${regLogs.length} registration events`);

  console.log("Fetching PurchaseExecuted events...");
  const purLogs = await fetchLogsRanged(provider, { address: CONTRACT, topics: [purTopic] }, START_BLOCK, head);
  console.log(`  ${purLogs.length} purchase events`);

  // Cache block timestamps we'll need
  const allBlocks = [...new Set([...regLogs, ...purLogs].map(l => l.blockNumber))];
  console.log(`Fetching ${allBlocks.length} block timestamps...`);
  const blockTs = new Map();
  const concurrency = 25;
  for (let i = 0; i < allBlocks.length; i += concurrency) {
    const batch = allBlocks.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(bn => provider.getBlock(bn).then(b => [bn, b.timestamp])));
    for (const [bn, ts] of results) blockTs.set(bn, ts);
  }

  // Decode logs
  const regs = regLogs.map(l => {
    const p = iface.parseLog(l);
    return {
      buyer: p.args.buyer.toLowerCase(),
      sourceToken: p.args.sourceToken.toLowerCase(),
      destinationToken: p.args.destinationToken.toLowerCase(),
      daysLeft: Number(p.args.daysLeft),
      buyTime: Number(p.args.buyTime),
      ts: blockTs.get(l.blockNumber),
      block: l.blockNumber,
      txHash: l.transactionHash,
    };
  });

  const purs = purLogs.map(l => {
    const p = iface.parseLog(l);
    return {
      buyer: p.args.buyer.toLowerCase(),
      sourceToken: p.args.sourceToken.toLowerCase(),
      destinationToken: p.args.destinationToken.toLowerCase(),
      daysLeft: Number(p.args.daysLeft),
      ts: blockTs.get(l.blockNumber),
      block: l.blockNumber,
      txHash: l.transactionHash,
    };
  });

  // Live state: registered buyers
  const registeredBuyers = (await contract.getRegisteredBuyers()).map(a => a.toLowerCase());
  console.log(`\nLive registered buyers: ${registeredBuyers.length}`);

  // For each (buyer, destToken) appearing in registrations, group regs by buyer+dest and pick LATEST registration
  // (handles re-registers after a session ends/cancels)
  const latestRegByKey = new Map();
  for (const r of regs) {
    const k = `${r.buyer}|${r.destinationToken}`;
    const prev = latestRegByKey.get(k);
    if (!prev || r.block > prev.block) latestRegByKey.set(k, r);
  }

  // Purchases per (buyer, dest) since latest registration
  const pursByKeySinceReg = new Map();
  for (const p of purs) {
    const k = `${p.buyer}|${p.destinationToken}`;
    const reg = latestRegByKey.get(k);
    if (!reg) continue;
    if (p.block < reg.block) continue;
    if (!pursByKeySinceReg.has(k)) pursByKeySinceReg.set(k, []);
    pursByKeySinceReg.get(k).push(p);
  }

  // Determine which (buyer, dest) sessions are STILL ACTIVE on-chain
  const activeKeys = [];
  console.log("\nQuerying live getDCAConfig for active sessions...");
  let queried = 0;
  for (const buyer of registeredBuyers) {
    // Find all dest tokens this buyer has registered
    const buyerRegs = regs.filter(r => r.buyer === buyer);
    const destTokens = [...new Set(buyerRegs.map(r => r.destinationToken))];
    for (const dest of destTokens) {
      try {
        const cfg = await contract.getDCAConfig(buyer, dest);
        const liveDaysLeft = Number(cfg.days_left);
        if (liveDaysLeft === 0) continue;
        activeKeys.push({
          key: `${buyer}|${dest}`,
          buyer, dest,
          liveDaysLeft,
          liveBuyTime: Number(cfg.buy_time),
          liveSourceToken: cfg.sourceToken.toLowerCase(),
        });
        queried++;
        if (queried % 10 === 0) process.stdout.write(`  ${queried} active...\r`);
      } catch {}
    }
  }
  console.log(`\nActive (live days_left > 0) sessions: ${activeKeys.length}`);

  const now = Math.floor(Date.now() / 1000);
  console.log(`\n"now" reference: ${new Date(now * 1000).toISOString()} (${now})`);

  // Pre-resolve unique token symbols
  const tokens = new Set();
  for (const a of activeKeys) {
    const reg = latestRegByKey.get(a.key);
    if (reg) tokens.add(reg.sourceToken);
    tokens.add(a.dest);
  }
  await Promise.all([...tokens].map(t => symbolFor(provider, t)));

  // Audit
  const rows = [];
  for (const a of activeKeys) {
    const reg = latestRegByKey.get(a.key);
    if (!reg) continue;

    const purList = pursByKeySinceReg.get(a.key) || [];
    const purchasesSeen = purList.length;

    // Count exact buy_time crossings: every time the daily HH:MM passes between
    // reg.ts (exclusive) and now (inclusive) is one expected execution.
    const elapsedSec = now - reg.ts;
    const buyHour = Math.floor(a.liveBuyTime / 100);
    const buyMin = a.liveBuyTime % 100;
    let crossings = 0;
    // First crossing: same UTC day as reg if buy_time is later than reg time, else next day
    const regDate = new Date(reg.ts * 1000);
    const firstTry = new Date(Date.UTC(
      regDate.getUTCFullYear(), regDate.getUTCMonth(), regDate.getUTCDate(),
      buyHour, buyMin, 0
    ));
    let cursor = firstTry.getTime() / 1000;
    if (cursor <= reg.ts) cursor += 86400;
    while (cursor <= now) { crossings++; cursor += 86400; }
    const expectedExecs = Math.min(crossings, reg.daysLeft);

    // What's actually been done = daysLeft at reg - liveDaysLeft
    const actualExecs = reg.daysLeft - a.liveDaysLeft;
    const missedExecs = expectedExecs - actualExecs;

    rows.push({
      buyer: a.buyer,
      pair: `${symbolCache.get(reg.sourceToken)} → ${symbolCache.get(a.dest)}`,
      buyTime: a.liveBuyTime,
      registered: new Date(reg.ts * 1000).toISOString().slice(0, 16) + "Z",
      ageDays: +(elapsedSec / 86400).toFixed(2),
      regDays: reg.daysLeft,
      liveDays: a.liveDaysLeft,
      actualExecs,
      expectedExecs,
      purchaseEventsSeen: purchasesSeen,
      missed: missedExecs,
      sanity: purchasesSeen === actualExecs ? "ok" : `mismatch(events=${purchasesSeen} vs computed=${actualExecs})`,
    });
  }

  rows.sort((a, b) => b.missed - a.missed);

  console.log("\n" + "=".repeat(140));
  console.log("PER-SESSION AUDIT (sorted by missed executions descending)");
  console.log("=".repeat(140));
  console.log(
    "buyer".padEnd(44) + " " +
    "pair".padEnd(20) + " " +
    "buyTime".padStart(7) + " " +
    "regAge".padStart(7) + " " +
    "regDays".padStart(8) + " " +
    "liveDays".padStart(9) + " " +
    "actual".padStart(7) + " " +
    "expect".padStart(7) + " " +
    "missed".padStart(7) + " " +
    "events"
  );
  for (const r of rows) {
    const flag = r.missed > 0 ? "❌" : r.missed < 0 ? "?" : "✓";
    console.log(
      `${r.buyer.padEnd(44)} ${r.pair.padEnd(20)} ${String(r.buyTime).padStart(7)} ${String(r.ageDays).padStart(7)} ${String(r.regDays).padStart(8)} ${String(r.liveDays).padStart(9)} ${String(r.actualExecs).padStart(7)} ${String(r.expectedExecs).padStart(7)} ${String(r.missed).padStart(7)} ${flag} ${r.sanity}`
    );
  }

  // Aggregates
  const totalActive = rows.length;
  const sessionsBehind = rows.filter(r => r.missed > 0).length;
  const totalMissed = rows.reduce((s, r) => s + Math.max(0, r.missed), 0);
  const totalExpected = rows.reduce((s, r) => s + r.expectedExecs, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualExecs, 0);

  console.log("\n" + "=".repeat(80));
  console.log("AGGREGATE");
  console.log("=".repeat(80));
  console.log(`Active sessions audited:           ${totalActive}`);
  console.log(`Sessions behind schedule:          ${sessionsBehind}`);
  console.log(`Total expected executions:         ${totalExpected}`);
  console.log(`Total actual executions:           ${totalActual}`);
  console.log(`Total missed executions:           ${totalMissed}`);
  console.log(`On-chain success rate:             ${totalExpected > 0 ? ((totalActual / totalExpected) * 100).toFixed(1) : "n/a"}%`);

  // Per-pair breakdown
  const byPair = new Map();
  for (const r of rows) {
    if (!byPair.has(r.pair)) byPair.set(r.pair, { sessions: 0, expected: 0, actual: 0, missed: 0, behind: 0 });
    const p = byPair.get(r.pair);
    p.sessions++;
    p.expected += r.expectedExecs;
    p.actual += r.actualExecs;
    p.missed += Math.max(0, r.missed);
    if (r.missed > 0) p.behind++;
  }
  console.log("\n" + "=".repeat(80));
  console.log("PER-PAIR ON-CHAIN STATE");
  console.log("=".repeat(80));
  console.log("pair".padEnd(20) + " " + "sessions".padStart(9) + " " + "behind".padStart(7) + " " + "expected".padStart(9) + " " + "actual".padStart(7) + " " + "missed".padStart(7) + " " + "rate");
  for (const [pair, v] of [...byPair.entries()].sort((a, b) => b[1].missed - a[1].missed)) {
    const rate = v.expected > 0 ? ((v.actual / v.expected) * 100).toFixed(1) + "%" : "n/a";
    console.log(`${pair.padEnd(20)} ${String(v.sessions).padStart(9)} ${String(v.behind).padStart(7)} ${String(v.expected).padStart(9)} ${String(v.actual).padStart(7)} ${String(v.missed).padStart(7)} ${rate}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
