import { ethers } from "ethers";

const RELAY_API_URL = "https://api.relay.link/quote";
const INK_CHAIN_ID = 57073;

// Dynamic slippage: scales with observed price impact, clamped to a safe band.
// Used by both the registration form (display) and the cron executor (on-chain minAmountOut)
// so the displayed slippage matches what actually gets enforced.
const SLIPPAGE_BUFFER = 1.5;   // 1.5× price impact → allows some market drift
const SLIPPAGE_MIN_BPS = 30;   // 0.3% floor — MEV protection on tiny/deep pools
const SLIPPAGE_MAX_BPS = 1000; // 10% cap — hard ceiling for thin-liquidity pairs
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

      // Surface Relay's actual errorCode (AMOUNT_TOO_LOW, NO_SWAP_ROUTES_FOUND, etc.)
      // instead of collapsing every 400 into a generic bucket — the form needs the
      // real code to decide whether to probe for a minimum or just show "no route".
      let errorCode = response.status === 400 ? "AMOUNT_NOT_SUPPORTED" : "API_ERROR";
      let errorBodyMessage = errorText;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.errorCode) errorCode = parsed.errorCode;
        if (parsed.message) errorBodyMessage = parsed.message;
      } catch {}

      return {
        error: errorCode,
        errorMessage: errorBodyMessage
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


// Lightweight one-shot quote: returns true if Relay accepts the amount, false on AMOUNT_TOO_LOW,
// null on any other error (network, NO_ROUTES, etc.) so callers can distinguish "too small" from
// "fundamentally unroutable" and avoid hammering the API on broken pairs.
async function quoteAccepts(contractAddress, sourceToken, destinationToken, amountIn) {
  try {
    const response = await fetch(RELAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "DCA-on-Ink/1.0" },
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
    if (response.ok) {
      const j = await response.json();
      return BigInt(j.details?.currencyOut?.amount || "0") > 0n ? true : false;
    }
    const txt = await response.text();
    try {
      const parsed = JSON.parse(txt);
      if (parsed.errorCode === "AMOUNT_TOO_LOW") return false;
    } catch {}
    return null;
  } catch {
    return null;
  }
}

// Binary-search Relay's current AMOUNT_TOO_LOW threshold for a specific (source, dest) pair.
// Called only when an existing quote came back AMOUNT_TOO_LOW, so the user's amount is the
// known-bad lower bound. Walks up by ×10 until accepted (max 6 steps, capping ~1M× input),
// then bisects to ~5% precision. Returns the smallest amount Relay will currently route, in
// source-token base units (BigInt). Roughly 4–6 API calls; ran on debounce same as fetchPriceImpact.
export async function findMinimumAmount(contractAddress, sourceToken, destinationToken, knownTooLowAmount) {
  let lo = BigInt(knownTooLowAmount);
  if (lo <= 0n) lo = 1n;
  let hi = lo;

  for (let i = 0; i < 6; i++) {
    hi = hi * 10n;
    const ok = await quoteAccepts(contractAddress, sourceToken, destinationToken, hi);
    if (ok === true) break;
    if (ok === null) return null; // unroutable for some other reason
    if (i === 5) return null; // even 1M× input rejected — pair likely broken
  }

  // Bisect lo..hi until within 5% precision
  while (hi - lo > lo / 20n + 1n) {
    const mid = (lo + hi) / 2n;
    const ok = await quoteAccepts(contractAddress, sourceToken, destinationToken, mid);
    if (ok === true) hi = mid;
    else if (ok === false) lo = mid;
    else return hi; // network blip — return the upper bound rather than loop
  }

  return hi;
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
