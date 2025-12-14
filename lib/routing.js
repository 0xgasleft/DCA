import { ethers } from "ethers";

const RELAY_API_URL = "https://api.relay.link/quote";
const INK_CHAIN_ID = 57073;


async function getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn) {
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
      console.error("Relay API error:", response.statusText);
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
  const relayResult = await getRelayQuote(contractAddress, sourceToken, destinationToken, amountIn);

  if (!relayResult || relayResult.amountOut === 0n) {
    throw new Error("Failed to get Relay quote");
  }

  console.log(`Relay quote: ${ethers.formatEther(relayResult.amountOut)} tokens`);

  return relayResult;
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
