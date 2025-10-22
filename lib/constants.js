export const CONTRACT_ABI = [
  "function getRegisteredBuyers() view returns (address[])",
  "function getDCAConfig(address user, address destinationToken) view returns (tuple(address sourceToken, address destinationToken, uint256 amount_per_day, uint256 days_left, uint256 buy_time, bool isNativeETH))",
  "function getUserDestinationTokens(address user) view returns (address[])",
  "function getWhitelistedTo(address token, address to) view returns (bool)",
  "function isExemptedFromFees(address user) view returns (bool)",
  "function getTokenMinFee(address token) view returns (uint256)",
  "function feeTreasury() view returns (address)",

  "function runDCA(address buyer, address destinationToken, tuple(address to, bytes data, uint256 value)[] calldata steps)",
  "function registerForDCAWithETH(address destinationToken, uint256 amountPerDay, uint256 daysLeft, uint256 buyTime) payable",
  "function registerForDCAWithToken(address sourceToken, address destinationToken, uint256 amountPerDay, uint256 daysLeft, uint256 buyTime) payable",
  "function giveUpDCA(address destinationToken)",

  "function setFeeTreasury(address feeTreasury)",
  "function setTokenMinFee(address token, uint256 minFee)",
  "function setTokenMinFees(address[] calldata tokens, uint256[] calldata minFees)",
  "function exemptFromFees(address user)",
  "function removeFromFeeExemption(address user)",
  "function exemptMultipleFromFees(address[] calldata users)",

  "event PurchaseExecuted(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountIn, uint256 amountOut, uint256 daysLeft)",
  "event RegisteredDCASession(address indexed buyer, address indexed sourceToken, address indexed destinationToken, uint256 amountPerDay, uint256 daysLeft, uint256 buyTime, bool isNativeETH)",
  "event DestroyedDCASession(address indexed buyer, uint256 amountRefunded)",
  "event FeeConfigUpdated(address feeTreasury)",
  "event TokenMinFeeUpdated(address indexed token, uint256 minFee)",
  "event ExemptedFromFees(address indexed user)",
  "event RemovedFromFeeExemption(address indexed user)"
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
];

export const V2_PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

export const V3_POOL_ABI = [
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function liquidity() view returns (uint128)"
];


const isBrowser = typeof window !== 'undefined';
export const CONTRACT_ADDRESS = isBrowser
  ? (import.meta.env?.VITE_CONTRACT_ADDRESS)
  : (process.env.CONTRACT_ADDRESS);

export const RELAY_RECEIVER = "0x7F4babd2C7D35221e72Ab67Ea72Cba99573A0089";
export const RELAY_SOLVER = "0xf70da97812CB96acDF810712Aa562db8dfA3dbEF";

export const RPC_URL = isBrowser
  ? import.meta.env?.VITE_RPC_URL
  : (process.env.RPC_URL);
export const PRIVATE_KEY = isBrowser ? undefined : process.env.RAND_K;

