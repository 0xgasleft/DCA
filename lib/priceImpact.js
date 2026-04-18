import { ethers } from "ethers";

const RELAY_API_URL = "https://api.relay.link/quote";
const INK_CHAIN_ID = 57073;

// Dynamic slippage: scales with observed price impact, clamped to a safe band.
// Used by both the registration form (display) and the cron executor (on-chain minAmountOut)
// so the displayed slippage matches what actually gets enforced.
const SLIPPAGE_BUFFER = 1.5;   // 1.5× price impact → allows some market drift
const SLIPPAGE_MIN_BPS = 30;   // 0.3% floor — MEV protection on tiny/deep pools
const SLIPPAGE_MAX_BPS = 500;  // 5% cap — never silently accept worse than this
const SLIPPAGE_FALLBACK_BPS = 100; // 1% when price impact is unknown

export function computeDynamicSlippageBps(priceImpactPercent) {
  if (priceImpactPercent == null || !isFinite(priceImpactPercent)) {
    return SLIPPAGE_FALLBACK_BPS;
  }
  const bps = Math.ceil(Math.abs(priceImpactPercent) * 100 * SLIPPAGE_BUFFER);
  return Math.min(SLIPPAGE_MAX_BPS, Math.max(SLIPPAGE_MIN_BPS, bps));
}

export async function fetchPriceImpact(contractAddress, sourceToken, destinationToken, amountIn) {
  try {
    const response = await fetch(RELAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DCA-on-Ink/1.0"
      },
      body: JSON.stringify({
        user: contractAddress,
        originChainId: INK_CHAIN_ID,
        destinationChainId: INK_CHAIN_ID,
        originCurrency: sourceToken,
        destinationCurrency: destinationToken,
        amount: amountIn.toString(),
        tradeType: "EXACT_INPUT",
        recipient: contractAddress
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Relay API error:", response.status, errorText);

      
      return {
        error: response.status === 400 ? "AMOUNT_NOT_SUPPORTED" : "API_ERROR",
        errorMessage: errorText
      };
    }

    const quote = await response.json();

    
    const amountOut = BigInt(quote.details?.currencyOut?.amount || "0");

    if (amountOut === 0n) {
      return null;
    }

    
    
    
    let priceImpact = 0;

    if (quote.details?.swapImpact?.percent !== undefined && quote.details?.swapImpact?.percent !== null) {
      priceImpact = parseFloat(quote.details.swapImpact.percent);
    } else if (quote.details?.totalImpact?.percent !== undefined && quote.details?.totalImpact?.percent !== null) {
      
      priceImpact = parseFloat(quote.details.totalImpact.percent);
    } else {
      
      if (quote.steps && Array.isArray(quote.steps)) {
        const numHops = quote.steps.length;
        priceImpact = -(numHops * 0.3);
      }
    }

    // Dynamic slippage derived from actual price impact (not Relay's fixed 1% default).
    // The cron executor uses the same formula so this display reflects what will be enforced on-chain.
    const slippageBps = computeDynamicSlippageBps(priceImpact);
    const slippagePercent = (slippageBps / 100).toFixed(2);
    const minOutputAmount = ((amountOut * BigInt(10000 - slippageBps)) / 10000n).toString();

    return {
      priceImpact: priceImpact,
      expectedOutput: amountOut,
      quote,
      requestId: quote.requestId,
      minOutputAmount,
      slippagePercent,
      slippageBps
    };
  } catch (error) {
    console.error("Error fetching price impact:", error.message);
    return null;
  }
}


export function formatPriceImpact(priceImpact) {
  if (priceImpact === null || priceImpact === undefined) {
    return "N/A";
  }

  const absValue = Math.abs(priceImpact);
  const sign = priceImpact >= 0 ? "+" : "-";

  if (absValue < 0.01) {
    return `${sign}<0.01%`;
  }

  return `${sign}${absValue.toFixed(2)}%`;
}


export function getPriceImpactSeverity(priceImpact) {
  const value = Math.abs(priceImpact);

  if (value < 1) return "low";      
  if (value < 3) return "medium";   
  if (value < 5) return "high";     
  return "extreme";                  
}
