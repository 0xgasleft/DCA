import { supabase } from "../lib/supabase.js";


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


export default async function handler(req, res) {
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      buyerAddress,
      sourceToken,
      destinationToken,
      amountPerDay,
      success,
      errorMessage,
      retryCount,
      transactionHash,
      priceImpact,
      slippagePercent,
      routerUsed,
      daysLeft
    } = req.body;

    
    if (!buyerAddress || !sourceToken || !destinationToken || !amountPerDay || success === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: buyerAddress, sourceToken, destinationToken, amountPerDay, success'
      });
    }

    const result = await storeDCAAttempt({
      buyerAddress,
      sourceToken,
      destinationToken,
      amountPerDay,
      success,
      errorMessage,
      retryCount,
      transactionHash,
      priceImpact,
      slippagePercent,
      routerUsed,
      daysLeft
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'DCA attempt tracked successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('[API] store-dca-attempt error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
