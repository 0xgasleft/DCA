import { supabase } from "./supabase.js";


export async function storeDCAAttempt({
  buyerAddress,
  sourceToken,
  destinationToken,
  amountPerDay,
  success,
  errorMessage = null,
  retryCount = 0,
  transactionHash = null,
  priceImpact = null,
  slippagePercent = null,
  routerUsed = null,
  daysLeft = null
}) {
  try {
    const { data, error } = await supabase
      .from('dca_attempt_tracking')
      .insert({
        buyer_address: buyerAddress.toLowerCase(),
        source_token: sourceToken.toLowerCase(),
        destination_token: destinationToken.toLowerCase(),
        amount_per_day: amountPerDay.toString(),
        success,
        error_message: errorMessage,
        retry_count: retryCount,
        transaction_hash: transactionHash ? transactionHash.toLowerCase() : null,
        price_impact: priceImpact,
        slippage_percent: slippagePercent,
        router_used: routerUsed,
        days_left: daysLeft,
        attempt_timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('[DCA Attempt Tracking] Failed to store attempt:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[DCA Attempt Tracking] Stored ${success ? 'SUCCESS' : 'FAILURE'} for ${buyerAddress} -> ${destinationToken}`);
    return { success: true, data };

  } catch (err) {
    console.error('[DCA Attempt Tracking] Error:', err.message);
    return { success: false, error: err.message };
  }
}
