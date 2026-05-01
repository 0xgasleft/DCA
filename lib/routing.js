import { ethers } from "ethers";
import { computeDynamicSlippageBps } from "./priceImpact.js";

const RELAY_API_URL = "https://api.relay.link/quote";
const INK_CHAIN_ID = 57073;


async function getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn, slippageBps = null) {
  try {
    const body = {
      user: contractAddress,
      originChainId: INK_CHAIN_ID,
      destinationChainId: INK_CHAIN_ID,
      originCurrency: sourceToken,
      destinationCurrency: destinationToken,
      amount: amountIn.toString(),
      tradeType: "EXACT_INPUT",
      recipient: contractAddress
    };
    if (slippageBps != null) {
      body.slippageTolerance = String(slippageBps);
    }
    const response = await fetch(RELAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DCA-on-Ink/1.0"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errCode = "UNKNOWN";
      try { errCode = JSON.parse(errBody).errorCode || "UNKNOWN"; } catch {}
      console.error(`Relay API error: ${response.status} ${errCode} - ${errBody}`);
      return null;
    }

    const quote = await response.json();
    const amountOut = BigInt(quote.details?.currencyOut?.amount);
    const requestId = quote.requestId;

    return {
      amountOut,
      quote,
      requestId
    };
  } catch (error) {
    console.error("Relay quote error:", error.message);
    return null;
  }
}


// probeImpact: when true, fetches a no-slippage quote first to measure price impact,
// then fetches the real execution quote with that impact-derived slippage.
// When false (default, first attempt), skips the probe and uses SLIPPAGE_FALLBACK_BPS directly —
// one fewer Relay call means lower latency and less chance of the probe itself hitting
// NO_SWAP_ROUTES_FOUND and poisoning the attempt.
export async function getRelaySwapData(contractAddress, sourceToken, destinationToken, amountIn, probeImpact = false) {
  let slippageBps;
  let priceImpact = null;

  if (probeImpact) {
    // Probe call: no slippage param so Relay returns impact data without constraints
    const probe = await getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn);
    if (probe && probe.amountOut !== 0n) {
      if (probe.quote?.details?.swapImpact?.percent != null) {
        priceImpact = parseFloat(probe.quote.details.swapImpact.percent);
      } else if (probe.quote?.details?.totalImpact?.percent != null) {
        priceImpact = parseFloat(probe.quote.details.totalImpact.percent);
      }
    } else {
      console.warn("Probe quote failed - proceeding with fallback slippage (1%)");
    }
    slippageBps = computeDynamicSlippageBps(priceImpact);
    console.log(`[probe] Price impact: ${priceImpact !== null ? priceImpact.toFixed(4) + '%' : 'unknown'} → slippage ${(slippageBps / 100).toFixed(2)}%`);
  } else {
    // Skip probe: use fallback slippage directly. Reduces total Relay calls per session from 2→1,
    // cutting latency and the window between quote issuance and on-chain submission.
    slippageBps = computeDynamicSlippageBps(null);
    console.log(`[direct] Using fallback slippage ${(slippageBps / 100).toFixed(2)}%`);
  }

  // Execution quote: steps from this response are submitted on-chain immediately after.
  const execQuote = await getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn, slippageBps);

  if (!execQuote || execQuote.amountOut === 0n) {
    throw new Error("Failed to get Relay execution quote");
  }

  // Capture impact from exec quote if probe was skipped
  if (priceImpact === null) {
    if (execQuote.quote?.details?.swapImpact?.percent != null) {
      priceImpact = parseFloat(execQuote.quote.details.swapImpact.percent);
    } else if (execQuote.quote?.details?.totalImpact?.percent != null) {
      priceImpact = parseFloat(execQuote.quote.details.totalImpact.percent);
    }
  }

  console.log(`Relay quote: ${ethers.formatEther(execQuote.amountOut)} tokens (slippage ${(slippageBps / 100).toFixed(2)}%)`);

  // Attach resolved impact so callers don't need to re-parse
  execQuote.resolvedPriceImpact = priceImpact;

  return execQuote;
}


function convertQuoteToSteps(quote) {
  const steps = [];

  for (const step of quote.steps) {
    for (const item of step.items || []) {
      if (item.data) {
        steps.push({
          to: item.data.to,
          data: item.data.data,
          value: item.data.value ? BigInt(item.data.value) : 0n
        });
      }
    }
  }

  return steps;
}


export async function executeDCA(contract, buyer, amountPerDay, sourceToken, destinationToken, probeImpact = false) {
  try {
    console.log(`Executing DCA for ${buyer}...`);
    console.log(`  Amount: ${ethers.formatEther(amountPerDay)}`);
    console.log(`  Source: ${sourceToken}`);
    console.log(`  Destination: ${destinationToken}`);

    const contractAddress = await contract.getAddress();
    const relayData = await getRelaySwapData(contractAddress, sourceToken, destinationToken, amountPerDay, probeImpact);

    const priceImpact = relayData.resolvedPriceImpact ?? null;

    // Read the slippage tolerance Relay actually encoded in the quote
    let slippagePercent = null;
    if (relayData.quote?.details?.slippageTolerance?.origin?.percent != null) {
      slippagePercent = parseFloat(relayData.quote.details.slippageTolerance.origin.percent);
    }

    console.log(`Executing via Relay...`);
    console.log(`  Expected output: ${ethers.formatEther(relayData.amountOut)}`);
    if (priceImpact !== null) {
      const sign = priceImpact >= 0 ? '+' : '';
      const impactType = priceImpact > 0 ? '(PROFITABLE)' : priceImpact < 0 ? '(UNFAVORABLE)' : '(NEUTRAL)';
      console.log(`  Price impact: ${sign}${priceImpact.toFixed(4)}% ${impactType}`);
    }

    const steps = convertQuoteToSteps(relayData.quote);
    console.log(`  Steps: ${steps.length}`);

    const tx = await contract.runDCA(buyer, destinationToken, steps);
    const receipt = await tx.wait();

    console.log(`DCA executed via Relay for ${buyer} — tx: ${receipt.hash}`);

    return {
      success: true,
      txHash: receipt.hash,
      router: "Relay",
      amountOut: relayData.amountOut,
      priceImpact,
      slippagePercent,
    };
  } catch (error) {
    console.error(`Error executing DCA for ${buyer}:`, error.message);
    throw error;
  }
}
