import { ethers } from "ethers";
import { CONTRACT_ADDRESS } from "./constants.js";
import { executeDCA } from "./routing.js";
import { supabase } from "./supabase.js";
import { storeDCAAttempt } from "./store-dca-attempt.js";

// "Relay step failed" = on-chain revert inside the swap — almost always a stale quote
// (deadline encoded in calldata expired, or price moved past slippage between fetch and mine).
// These need a fresh quote immediately, not a timed backoff.
const STALE_QUOTE_PATTERN = /relay step failed/i;

async function doDCA(contract, session, probeImpact = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing session: ${session.address} -> ${session.destination_token}`);

  const config = await contract.getDCAConfig(session.address, session.destination_token);
  const { sourceToken, destinationToken, amount_per_day, days_left, isNativeETH } = config;

  console.log(`DCA Config:`);
  console.log(`  Source Token: ${isNativeETH ? 'ETH (native)' : sourceToken}`);
  console.log(`  Destination Token: ${destinationToken}`);
  console.log(`  Amount per day: ${ethers.formatEther(amount_per_day)}`);
  console.log(`  Days left: ${days_left.toString()}`);

  const actualSourceToken = isNativeETH
    ? "0x0000000000000000000000000000000000000000"
    : sourceToken;

  const result = await executeDCA(
    contract,
    session.address,
    amount_per_day,
    actualSourceToken,
    destinationToken,
    probeImpact
  );

  await storeDCAAttempt({
    buyerAddress: session.address,
    sourceToken: actualSourceToken,
    destinationToken: destinationToken,
    amountPerDay: amount_per_day,
    success: result.success,
    errorMessage: result.success ? null : (result.error || 'Unknown error'),
    retryCount: 0,
    transactionHash: result.txHash || null,
    priceImpact: result.priceImpact || null,
    slippagePercent: result.slippagePercent || null,
    routerUsed: result.router || null,
    daysLeft: parseInt(days_left.toString())
  });

  try {
    const { error: statsError } = await supabase.rpc('increment_execution_stats', {
      p_source_token: actualSourceToken.toLowerCase(),
      p_destination_token: destinationToken.toLowerCase(),
      p_volume_executed: amount_per_day.toString()
    });

    if (statsError) {
      console.error('Failed to update execution stats:', statsError.message);
    } else {
      console.log(`Stats updated: +${ethers.formatEther(amount_per_day)} executed, +1 purchase`);
    }
  } catch (statsErr) {
    console.error('Stats tracking error:', statsErr.message);
  }

  if (result.success && result.priceImpact !== null && result.priceImpact !== undefined) {
    try {
      const exchangeRate = Number(result.amountOut) > 0 && Number(amount_per_day) > 0
        ? Number(result.amountOut) / Number(amount_per_day)
        : null;

      const blockTimestamp = Math.floor(Date.now() / 1000);

      const { error: impactError } = await supabase
        .from('price_impact_cache')
        .upsert({
          tx_hash: result.txHash.toLowerCase(),
          buyer: session.address.toLowerCase(),
          source_token: actualSourceToken.toLowerCase(),
          destination_token: destinationToken.toLowerCase(),
          price_impact: result.priceImpact,
          slippage_percent: result.slippagePercent,
          amount_in: amount_per_day.toString(),
          amount_out: result.amountOut.toString(),
          exchange_rate: exchangeRate,
          block_number: null,
          timestamp: blockTimestamp,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'tx_hash'
        });

      if (impactError) {
        console.error('Failed to store price impact:', impactError.message);
      } else {
        console.log(`Price impact stored: ${result.priceImpact.toFixed(4)}%`);
        if (result.slippagePercent !== null) {
          console.log(`Slippage tolerance: ${result.slippagePercent}%`);
        }
      }
    } catch (impactErr) {
      console.error('Price impact storage error:', impactErr.message);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
  return result;
}

export default async function launchDCA(contract, sessions) {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  DCA EXECUTION STARTED');
    console.log('═'.repeat(60));
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Total sessions: ${sessions.length}\n`);

    let successCount = 0;
    const results = [];

    // Retry schedule: [delay_ms, probeImpact]
    // - Attempt 1: no probe, no delay — single quote call, minimal latency
    // - Attempt 2 (stale quote / NO_ROUTES): 0ms for stale-quote reverts (need fresh quote
    //   immediately), 2s for API errors; probe to get accurate slippage
    // - Attempt 3: 6s backoff with probe
    const RETRY_SCHEDULE = [
      { delayMs: 0,    probe: true },  // attempt 2
      { delayMs: 6000, probe: true },  // attempt 3
    ];

    for (const session of sessions) {
      let lastErr = null;
      let succeeded = false;

      for (let attempt = 0; attempt <= RETRY_SCHEDULE.length; attempt++) {
        if (attempt > 0) {
          const { delayMs, probe } = RETRY_SCHEDULE[attempt - 1];
          // Stale-quote reverts need a fresh quote right away, not a backoff wait
          const isStaleQuote = lastErr && STALE_QUOTE_PATTERN.test(lastErr.message);
          const actualDelay = isStaleQuote ? 0 : delayMs;
          if (actualDelay > 0) {
            console.log(`Retry ${attempt}/${RETRY_SCHEDULE.length} for ${session.address} -> ${session.destination_token} after ${actualDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, actualDelay));
          } else {
            console.log(`Retry ${attempt}/${RETRY_SCHEDULE.length} for ${session.address} -> ${session.destination_token} (immediate — ${isStaleQuote ? 'stale quote' : 'no delay'})...`);
          }
          try {
            const result = await doDCA(contract, session, probe);
            successCount++;
            results.push({ session: { address: session.address, destination_token: session.destination_token }, ...result, retried: true, attempts: attempt + 1 });
            succeeded = true;
            break;
          } catch (err) {
            lastErr = err;
            console.error(`Attempt ${attempt + 1} failed for ${session.address} -> ${session.destination_token}: ${err.message}`);
          }
        } else {
          try {
            const result = await doDCA(contract, session, false);
            successCount++;
            results.push({ session: { address: session.address, destination_token: session.destination_token }, ...result, retried: false, attempts: 1 });
            succeeded = true;
            break;
          } catch (err) {
            lastErr = err;
            console.error(`Attempt 1 failed for ${session.address} -> ${session.destination_token}: ${err.message}`);
          }
        }
      }

      if (!succeeded) {
        await storeDCAAttempt({
          buyerAddress: session.address,
          sourceToken: session.source_token,
          destinationToken: session.destination_token,
          amountPerDay: session.amount_per_day,
          success: false,
          errorMessage: lastErr.message,
          retryCount: RETRY_SCHEDULE.length,
          transactionHash: null,
          priceImpact: null,
          slippagePercent: null,
          routerUsed: null,
          daysLeft: parseInt(session.days_left)
        });

        results.push({ session: { address: session.address, destination_token: session.destination_token }, success: false, error: lastErr.message });
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  DCA EXECUTION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total successful: ${successCount}/${sessions.length}`);
    console.log(`Failed: ${sessions.length - successCount}`);

    const routerStats = {};
    results.filter(r => r.success).forEach(r => {
      routerStats[r.router] = (routerStats[r.router] || 0) + 1;
    });

    console.log('\nRouter Usage:');
    Object.entries(routerStats).forEach(([router, count]) => {
      console.log(`  ${router}: ${count} swap(s)`);
    });
    console.log('═'.repeat(60) + '\n');

    return results;

  } catch (err) {
    console.error("Fatal DCA error:", err);
    throw err;
  }
}
