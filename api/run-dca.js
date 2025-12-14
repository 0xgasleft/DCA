import { ethers } from "ethers";
import { CONTRACT_ADDRESS, RPC_URL } from "../lib/constants.js";
import { executeDCA } from "../lib/routing.js";
import { supabase } from "../lib/supabase.js";
import { storeDCAAttempt } from "./store-dca-attempt.js";

async function doDCA(contract, session) {
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
    destinationToken
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
    console.log(`RPC URL: ${RPC_URL}`);
    console.log(`Total sessions: ${sessions.length}\n`);

    let successCount = 0;
    const results = [];

    for (const session of sessions) {
      try {
        const result = await doDCA(contract, session);
        successCount++;
        results.push({ session: { address: session.address, destination_token: session.destination_token }, ...result });

      } catch (err) {
        console.error(`Error processing session ${session.address} -> ${session.destination_token}:`, err.message);
        console.log("Attempting retry after 3 seconds...");

        try {
          await new Promise(resolve => setTimeout(resolve, 3000));

          
          const config = await contract.getDCAConfig(session.address, session.destination_token);
          const { sourceToken, destinationToken, amount_per_day, days_left, isNativeETH } = config;
          const actualSourceToken = isNativeETH ? "0x0000000000000000000000000000000000000000" : sourceToken;

          const result = await doDCA(contract, session);

          
          await storeDCAAttempt({
            buyerAddress: session.address,
            sourceToken: actualSourceToken,
            destinationToken: session.destination_token,
            amountPerDay: amount_per_day,
            success: true,
            errorMessage: null,
            retryCount: 1,
            transactionHash: result.txHash || null,
            priceImpact: result.priceImpact || null,
            slippagePercent: result.slippagePercent || null,
            routerUsed: result.router || null,
            daysLeft: parseInt(days_left.toString())
          });

          successCount++;
          results.push({ session: { address: session.address, destination_token: session.destination_token }, ...result, retried: true });
        } catch (retryErr) {
          console.error(`Retry failed for session ${session.address} -> ${session.destination_token}:`, retryErr.message);

          
          try {
            const config = await contract.getDCAConfig(session.address, session.destination_token);
            const { sourceToken, destinationToken, amount_per_day, days_left, isNativeETH } = config;
            const actualSourceToken = isNativeETH ? "0x0000000000000000000000000000000000000000" : sourceToken;

            
            await storeDCAAttempt({
              buyerAddress: session.address,
              sourceToken: actualSourceToken,
              destinationToken: session.destination_token,
              amountPerDay: amount_per_day,
              success: false,
              errorMessage: retryErr.message,
              retryCount: 1,
              transactionHash: null,
              priceImpact: null,
              slippagePercent: null,
              routerUsed: null,
              daysLeft: parseInt(days_left.toString())
            });
          } catch (configErr) {
            console.error('Failed to get config for retry tracking:', configErr.message);
          }

          results.push({ session: { address: session.address, destination_token: session.destination_token }, success: false, error: retryErr.message });
        }
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
