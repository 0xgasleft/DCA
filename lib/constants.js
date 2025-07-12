export const CONTRACT_ABI = [
  "function getRegisteredBuyers() view returns (address[])",
  "function dcaConfigs(address) view returns (uint256 amount_per_day, uint256 days_left)",
  "function runDCA(address,uint256)"
];

export const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory)"
];

export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
export const ROUTER_ADDRESS = "0xA8C1C38FF57428e5C3a34E0899Be5Cb385476507";

export const RPC_URL = process.env.RPC_URL;
export const PRIVATE_KEY = process.env.RAND_K;
