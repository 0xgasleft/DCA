import { ethers } from "ethers";

const RPC = "https://rpc-gel.inkonchain.com";
const CONTRACT = "0x4286643d9612515F487c2F3272845bc53Ca80705";
const ABI = [
  "function getDCAConfig(address user, address destinationToken) view returns (tuple(address sourceToken, address destinationToken, uint256 amount_per_day, uint256 days_left, uint256 buy_time, bool isNativeETH))",
];
const ERC20 = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];

const failingSessions = [
  { buyer: "0xf8511574d0badae36e7f28eb3726e31c6b50e920", dest: "0x0000000000000000000000000000000000000000" },
  { buyer: "0x0566aa0c72a83e3e72857dcc52ebcc7e481cc37f", dest: "0x0000000000000000000000000000000000000000" },
  { buyer: "0x325f3e52bb8529352091a268f60750ba5a978cc4", dest: "0x0000000000000000000000000000000000000000" },
  { buyer: "0xd4f6ae01d6a79595c872c25d302a4404b3923374", dest: "0x0606fc63c95cAbBF6F6e44C7eA8166D9d49E26A8" },
  { buyer: "0x66dc2cccd7fa6206617a8bdee3fb6dc21b848a3a", dest: "0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98" },
  { buyer: "0x18ffe0ef3ab518d59e29d672fddef0d0131578a0", dest: "0x0000000000000000000000000000000000000000" },
  { buyer: "0x2b375d7c4fd1906d683867aa6ea93a63b401db1e", dest: "0x0000000000000000000000000000000000000000" },
];

const provider = new ethers.JsonRpcProvider(RPC);
const contract = new ethers.Contract(CONTRACT, ABI, provider);

const tokenInfo = new Map();
async function info(addr) {
  const k = addr.toLowerCase();
  if (tokenInfo.has(k)) return tokenInfo.get(k);
  if (k === "0x0000000000000000000000000000000000000000") { const v = { sym: "ETH", dec: 18 }; tokenInfo.set(k, v); return v; }
  const c = new ethers.Contract(addr, ERC20, provider);
  const [sym, dec] = await Promise.all([c.symbol(), c.decimals()]);
  const v = { sym, dec: Number(dec) };
  tokenInfo.set(k, v);
  return v;
}

console.log("buyer".padEnd(44) + "  pair                amount_per_day            human");
for (const s of failingSessions) {
  const cfg = await contract.getDCAConfig(s.buyer, s.dest);
  const srcAddr = cfg.isNativeETH ? "0x0000000000000000000000000000000000000000" : cfg.sourceToken;
  const src = await info(srcAddr);
  const dst = await info(s.dest);
  const amt = cfg.amount_per_day;
  const human = ethers.formatUnits(amt, src.dec);
  console.log(
    `${s.buyer.padEnd(44)}  ${(src.sym + ' → ' + dst.sym).padEnd(20)} ${amt.toString().padStart(20)}    ${human} ${src.sym}`
  );
}
