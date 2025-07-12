import { ethers } from "ethers";
import { RPC_URL, PRIVATE_KEY } from "./constants.js";

export const provider = new ethers.JsonRpcProvider(RPC_URL);
export const signer = new ethers.Wallet(PRIVATE_KEY, provider);
