import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ROUTER_ADDRESS, ROUTER_ABI, RPC_URL } from "../lib/constants.js";
import { signer } from "../lib/provider.js";

const BUY_PATH = [
  "0x4200000000000000000000000000000000000006", // WETH
  "0x0606FC632ee812bA970af72F8489baAa443C4B98"  // ANITA
];

async function doDCA(contract, router, buyer) {
  console.log(`Processing buyer: ${buyer}`);
  const { amount_per_day } = await contract.dcaConfigs(buyer);
  console.log(`Executing DCA for ${buyer} with amount_per_day: ${ethers.formatEther(amount_per_day)} ETH`);
  const amounts = await router.getAmountsOut(amount_per_day, BUY_PATH);
  let amountOutMin = amounts[amounts.length - 1];
  amountOutMin = amountOutMin * 95n / 100n;
  console.log(`Calculated amountOutMin with 5% slippage: ${ethers.formatEther(amountOutMin)} ANITA`);
  const tx = await contract.runDCA(buyer, amountOutMin);
  await tx.wait();
  console.log(`✅ BUY executed for ${buyer} at ${tx.hash}`);
}

export default async function launchDCA(contract, buyers) {
  try {

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    console.log(`Using DCA contract: ${CONTRACT_ADDRESS}`);
    console.log(`Using router: ${ROUTER_ADDRESS}`);
    console.log(`Using RPC URL: ${RPC_URL}`);

    let successCount = 0;
    for (const buyer of buyers) {
      try {
        await doDCA(contract, router, buyer);
        successCount++;

      } catch (err) {
        console.error(`❌ Error processing buyer ${buyer}:`, err.message);
        console.log("Attempting a retry after 3 seconds...");
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          await doDCA(contract, router, buyer);
          successCount++;
        }
        catch (retryErr) {
          console.error(`❌ Retry failed for buyer ${buyer}:`, retryErr.message);
        }
        console.warn(`⚠️ Skipped ${buyer}!`);
      }
    }

    console.log(`DCA execution complete. Total successful: ${successCount}/${buyers.length}`);

  } catch (err) {
    console.error("❌ Backend DCA error:", err);
  }
}
