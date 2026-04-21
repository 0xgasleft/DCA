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


export async function getRelaySwapData(contractAddress, sourceToken, destinationToken, amountIn) {
  // Call 1: probe for actual price impact. Best-effort — Relay can transiently return
  // NO_SWAP_ROUTES_FOUND on a single block; we'd rather fall back to a sane default
  // slippage and try the real execution call than fail the DCA outright.
  const probe = await getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn);

  let priceImpact = null;
  if (probe && probe.amountOut !== 0n) {
    if (probe.quote?.details?.swapImpact?.percent != null) {
      priceImpact = parseFloat(probe.quote.details.swapImpact.percent);
    } else if (probe.quote?.details?.totalImpact?.percent != null) {
      priceImpact = parseFloat(probe.quote.details.totalImpact.percent);
    }
  } else {
    console.warn("Probe quote failed - proceeding with fallback slippage (1%)");
  }
  const slippageBps = computeDynamicSlippageBps(priceImpact);

  console.log(`Price impact: ${priceImpact !== null ? priceImpact.toFixed(4) + '%' : 'unknown'} → slippage ${(slippageBps / 100).toFixed(2)}%`);

  // Call 2: real execution quote. Steps from this call get sent on-chain, so this one must succeed.
  const execQuote = await getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn, slippageBps);

  if (!execQuote || execQuote.amountOut === 0n) {
    throw new Error("Failed to get Relay execution quote");
  }

  console.log(`Relay quote: ${ethers.formatEther(execQuote.amountOut)} tokens (slippage ${(slippageBps / 100).toFixed(2)}%)`);

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


export async function executeDCA(contract, buyer, amountPerDay, sourceToken, destinationToken) {
  try {
    console.log(`Executing DCA for ${buyer}...`);
    console.log(`  Amount: ${ethers.formatEther(amountPerDay)}`);
    console.log(`  Source: ${sourceToken}`);
    console.log(`  Destination: ${destinationToken}`);

    const contractAddress = await contract.getAddress();
    const relayData = await getRelaySwapData(contractAddress, sourceToken, destinationToken, amountPerDay);

    
    
    let priceImpact = null;
    if (relayData.quote?.details?.swapImpact?.percent !== undefined && relayData.quote?.details?.swapImpact?.percent !== null) {
      priceImpact = parseFloat(relayData.quote.details.swapImpact.percent);
    } else if (relayData.quote?.details?.totalImpact?.percent !== undefined && relayData.quote?.details?.totalImpact?.percent !== null) {
      priceImpact = parseFloat(relayData.quote.details.totalImpact.percent);
    } else {
      console.log("Price impact data not available in Relay quote");
    }

    
    let slippagePercent = null;
    if (relayData.quote?.details?.slippageTolerance?.origin?.percent !== undefined && relayData.quote?.details?.slippageTolerance?.origin?.percent !== null) {
      slippagePercent = parseFloat(relayData.quote.details.slippageTolerance.origin.percent);
    }
    else {
      console.log("Slippage tolerance data not available in Relay quote");
    }

    console.log(`Executing via Relay...`);
    console.log(`  Expected output: ${ethers.formatEther(relayData.amountOut)}`);
    if (priceImpact !== null) {
      const sign = priceImpact >= 0 ? '+' : '';
      const impactType = priceImpact > 0 ? '(PROFITABLE)' : priceImpact < 0 ? '(UNFAVORABLE)' : '(NEUTRAL)';
      console.log(`  Actual price impact: ${sign}${priceImpact.toFixed(4)}% ${impactType}`);
      console.log(`  Note: Price impact may differ from expected due to market changes since registration`);
    }

    const steps = convertQuoteToSteps(relayData.quote);
    console.log(`  Steps: ${steps.length}`);

    const tx = await contract.runDCA(buyer, destinationToken, steps);
    const receipt = await tx.wait();

    console.log(`DCA executed via Relay for ${buyer}`);
    console.log(`  Tx hash: ${receipt.hash}`);
    if (priceImpact !== null) {
      console.log(`  Final price impact: ${priceImpact > 0 ? '+' : ''}${priceImpact.toFixed(4)}%`);
    }

    return {
      success: true,
      txHash: receipt.hash,
      router: "Relay",
      amountOut: relayData.amountOut,
      priceImpact: priceImpact, 
      slippagePercent: slippagePercent, 
    };
  } catch (error) {
    console.error(`Error executing DCA for ${buyer}:`, error.message);
    throw error;
  }
}
