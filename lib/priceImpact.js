import { ethers } from "ethers";

const RELAY_API_URL = "https://api.relay.link/quote";
const INK_CHAIN_ID = 57073;

/**
 * Fetch price impact data from Relay API
 * @param {string} contractAddress - The DCA contract address
 * @param {string} sourceToken - Source token address
 * @param {string} destinationToken - Destination token address
 * @param {BigInt} amountIn - Amount to swap (in wei)
 * @returns {Promise<{priceImpact: number, expectedOutput: BigInt, quote: any, minOutputAmount: string, slippagePercent: string, error?: string} | null>}
 */
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

      // Return error object instead of null so we can show specific messages
      return {
        error: response.status === 400 ? "AMOUNT_NOT_SUPPORTED" : "API_ERROR",
        errorMessage: errorText
      };
    }

    const quote = await response.json();

    // Extract output amount
    const amountOut = BigInt(quote.details?.currencyOut?.amount || "0");

    if (amountOut === 0n) {
      return null;
    }

    // Extract price impact from Relay's swapImpact.percent field
    // Relay returns as string like "-0.41" for -0.41%
    // POSITIVE = profitable (you get more), NEGATIVE = unprofitable (you get less)
    let priceImpact = 0;

    if (quote.details?.swapImpact?.percent !== undefined && quote.details?.swapImpact?.percent !== null) {
      priceImpact = parseFloat(quote.details.swapImpact.percent);
    } else if (quote.details?.totalImpact?.percent !== undefined && quote.details?.totalImpact?.percent !== null) {
      // Fallback to totalImpact if swapImpact not available
      priceImpact = parseFloat(quote.details.totalImpact.percent);
    } else {
      // Last resort: estimate from number of steps (negative since it's a cost)
      if (quote.steps && Array.isArray(quote.steps)) {
        const numHops = quote.steps.length;
        priceImpact = -(numHops * 0.3);
      }
    }

    // Extract slippage tolerance and minimum output
    const minOutputAmount = quote.details?.currencyOut?.minimumAmount || null;
    const slippagePercent = quote.details?.slippageTolerance?.origin?.percent || null;

    return {
      priceImpact: priceImpact, // Preserve sign from Relay
      expectedOutput: amountOut,
      quote,
      requestId: quote.requestId,
      minOutputAmount,    // Minimum output after slippage
      slippagePercent     // Slippage tolerance percentage
    };
  } catch (error) {
    console.error("Error fetching price impact:", error.message);
    return null;
  }
}

/**
 * Format price impact for display (preserves sign)
 * @param {number} priceImpact - Price impact as decimal (e.g., 0.5 for 0.5%, -0.5 for -0.5%)
 * @returns {string}
 */
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

/**
 * Get price impact severity level for UI styling
 * @param {number} priceImpact - Price impact as decimal
 * @returns {"low" | "medium" | "high" | "extreme"}
 */
export function getPriceImpactSeverity(priceImpact) {
  const value = Math.abs(priceImpact);

  if (value < 1) return "low";      // < 1%
  if (value < 3) return "medium";   // 1-3%
  if (value < 5) return "high";     // 3-5%
  return "extreme";                  // > 5%
}
