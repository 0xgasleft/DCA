import { supabase } from "../lib/supabase.js";


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { txHash, buyer, sourceToken, destinationToken, priceImpact, amountIn, amountOut } = req.body;

    if (!txHash || !buyer || !sourceToken || !destinationToken) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    
    const { data, error } = await supabase
      .from('price_impact_cache')
      .upsert({
        tx_hash: txHash.toLowerCase(),
        buyer: buyer.toLowerCase(),
        source_token: sourceToken.toLowerCase(),
        destination_token: destinationToken.toLowerCase(),
        price_impact: priceImpact,
        amount_in: amountIn?.toString(),
        amount_out: amountOut?.toString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'tx_hash'
      });

    if (error) {
      console.error("Error storing price impact:", error);
      return res.status(500).json({ error: "Failed to store price impact" });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Store price impact error:", err);
    return res.status(500).json({ error: err.message });
  }
}
