import { useState } from "react";
import { ethers } from "ethers";
import { FaSpinner } from "react-icons/fa";
import { useEffect } from "react";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/react"



const CONTRACT_ADDRESS = "0x391DB8701c9307eF0D90785F74D621c98f27985f";
const ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amount_per_day", "type": "uint256" },
      { "internalType": "uint256", "name": "_days_left", "type": "uint256" }
    ],
    "name": "registerForDCA",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeConfig",
    "outputs": [
      { "internalType": "address", "name": "feeTreasury", "type": "address" },
      { "internalType": "uint256", "name": "minFee", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "dcaConfigs",
    "outputs": [
      { "internalType": "uint256", "name": "amount_per_day", "type": "uint256" },
      { "internalType": "uint256", "name": "days_left", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "giveUpDCA",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "daysLeft", "type": "uint256" }
    ],
    "name": "PurchaseExecuted",
    "type": "event"
  }

];

const INK_CHAIN = {
  chainId: "0xdef1",
  chainName: "Ink",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETG",
    decimals: 18,
  },
  rpcUrls: ["https://ink.drpc.org"],
  blockExplorerUrls: ["https://explorer.inkonchain.com"],
};

const switchToInk = async () => {
  const chainId = INK_CHAIN.chainId;

  try {
    const currentChain = await window.ethereum.request({ method: "eth_chainId" });

    if (currentChain !== chainId) {
      try {
        
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId }],
        });
      } catch (switchError) {
        
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [INK_CHAIN],
            });
          } catch (addError) {
            throw new Error("Could not add Ink chain");
          }
        } else {
          throw new Error("Switch failed");
        }
      }
    }
  } catch (err) {
    console.error(err);
    throw new Error("Chain switch failed");
  }
};

const formatTimestamp = (unixTimestamp) => {
  const date = new Date(unixTimestamp * 1000);
  const pad = (n) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // Months are 0-indexed
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export default function App() {
  inject();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [amountPerDay, setAmountPerDay] = useState("");
  const [daysLeft, setDaysLeft] = useState("");
  const [status, setStatus] = useState("");
  const [buyTime, setBuyTime] = useState("00:00");
  const [minFee, setMinFee] = useState(null);
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [dcaInfo, setDcaInfo] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [activePurchases, setActivePurchases] = useState([]);
  const [activeTab, setActiveTab] = useState("register"); // register | activeSession | history
  const [fetchingPurchases, setFetchingPurchases] = useState(false);




  const provider = window.ethereum ? new ethers.BrowserProvider(window.ethereum): null;
  let contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const formatAddress = (addr) => addr.slice(0, 6) + "..." + addr.slice(-4);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
      } else {
        setWalletConnected(false);
        setWalletAddress("");
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!provider) return;
    const loadMinFee = async () => {
      const feeConfig = await contract.feeConfig();
      setMinFee(Number(ethers.formatEther(feeConfig.minFee)));
    };

    loadMinFee();
  }, []);

  useEffect(() => {
    if (!amountPerDay || !daysLeft || minFee === null) {
      setCalculatedFee(null);
      return;
    }

    const parsedAmount = parseFloat(amountPerDay);
    const parsedDays = parseFloat(daysLeft);

    if (isNaN(parsedAmount) || isNaN(parsedDays)) {
      setCalculatedFee(null);
      return;
    }

    const total = parsedAmount * parsedDays;
    const fee = total * 0.001;

    const finalFee = Math.max(fee, minFee);
    setCalculatedFee(`${finalFee.toFixed(5)} ETH`);
  }, [amountPerDay, daysLeft, minFee]);

  useEffect(() => {
    if (walletConnected) {
      fetchDcaInfo();
    }
  }, [walletConnected]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchActivePurchases(walletAddress);
    } else {
      setActivePurchases([]);
    }
  }, [walletConnected, walletAddress]);


  const fetchDcaInfo = async () => {
    if (!walletAddress || !provider) return;

    try {
      const config = await contract.dcaConfigs(walletAddress);
      if (config.days_left > 0) {
        setDcaInfo({
          amountPerDay: parseFloat(ethers.formatEther(config.amount_per_day)).toFixed(5),
          daysLeft: Number(config.days_left),
        });
      } else {
        setDcaInfo(null);
      }
    } catch (err) {
      console.error("Failed fetching DCA info", err);
      setDcaInfo(null);
    }
  };

  const fetchActivePurchases = async (address) => {
    if (!contract || !address) return;

    setFetchingPurchases(true);
    try {
      const filter = contract.filters.PurchaseExecuted(address);
      const events = await contract.queryFilter(filter, 19542679, "latest"); // from contract deployment block to current

      const purchases = await Promise.all(events.map(async (e) => {
        const block = await provider.getBlock(e.blockNumber);
        return {
          amount: ethers.formatEther(e.args.amount),
          txHash: e.transactionHash,
          datetime: formatTimestamp(block.timestamp)
        };
      }));

      setActivePurchases(purchases);
    } catch (err) {
      console.error("Failed to fetch purchase events", err);
      setActivePurchases([]);
    }
    setFetchingPurchases(false);
  }

  const connectWallet = async () => {
    if (!window.ethereum) return toast.error("Please install MetaMask/Rabby");

    try {
      await provider.send("eth_requestAccounts", []);
      await switchToInk();

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletConnected(true);
      setWalletAddress(address);

      setStatus("✅ Wallet connected and switched to Ink");
    } catch (err) {
      console.error(err);
      setStatus("❌ Wallet connection or chain switch failed");
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress("");
    setAmountPerDay("");
    setDaysLeft("");
    setBuyTime("00:00");
    setCalculatedFee(null);
    setDcaInfo(null);
    setStatus("");
    setMinFee(null);
  };

  const register = async () => {
    if (!walletConnected) return toast.warning("Connect wallet first");
    if (!amountPerDay || !daysLeft || !buyTime) return toast.error("All fields are required");

    const minEth = 0.00005;
    if (parseFloat(amountPerDay) < minEth) {
      return toast.error(`Amount per day must be at least ${minEth} ETH`);
    }

    if (parseInt(daysLeft) <= 0 || parseInt(daysLeft) > 365) {
      return toast.error("Days must be between 1 and 365");
    }

    if (!/^\d{2}:\d{2}$/.test(buyTime)) {
      return toast.error("Buy time must be in HH:MM format");
    }
    const [hour, minute] = buyTime.split(":").map(Number);
    if (hour > 23 || minute > 59) {
      return toast.error("Invalid buy time value");
    }

    try {
      
      const signer = await provider.getSigner();
      contract = contract.connect(signer);
      const feeCfg = await contract.feeConfig();
      setMinFee(parseFloat(ethers.formatEther(feeCfg.minFee)));

      const amountWei = ethers.parseEther(amountPerDay);
      const days = BigInt(daysLeft);
      const dcaTotal = amountWei * days;

      const zeroPointOnePercent = dcaTotal / BigInt(1000);
      const minFeeWei = ethers.parseEther(minFee != null ? minFee.toFixed(18) : "0.00005");

      const fee = zeroPointOnePercent > minFeeWei ? zeroPointOnePercent : minFeeWei;

      const total = dcaTotal + fee;


      setLoading(true);
      setStatus("⏳ Registering... (please wait)");
      const tx = await contract.registerForDCA(amountWei, daysLeft, {
        value: total,
      });
      await tx.wait();

      //setStatus("⏳ Saving data to backend...");
      const walletAddress = await signer.getAddress();

      const res = await fetch("/api/register-dca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          buy_time: buyTime
        }),
      });
      if (!res.headers.get("Content-Type")?.includes("application/json")) {
        console.error("Unexpected response format:", res.headers.get("Content-Type"));
        throw new Error("Error occured while registering DCA");
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Backend registration failed");
      }

      fetchDcaInfo(); 
      setStatus("✅ Registered successfully!");

      setAmountPerDay("");
      setDaysLeft("");
      setBuyTime("00:00");
      setLoading(false);

    } catch (err) {
      console.error(err);

      const reason =
        err?.revert?.args?.[0] ??
        err?.shortMessage ??
        err?.message ??
        "Transaction failed";

      setStatus("❌ " + reason);
    }
  };

  const stopDCA = async () => {
    setStopping(true);
    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      const tx = await contractWithSigner.giveUpDCA();
      await tx.wait();
      toast.success("DCA session stopped.");
      setDcaInfo(null); // remove display
    } catch (err) {
      console.error(err);
      toast.error("Failed to stop DCA.");
    }
    setStopping(false);
  };

  const totalETH = parseFloat(amountPerDay || 0) * parseInt(daysLeft || 0);


  return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">

        <div className="flex items-center justify-between mb-4">
          <a
            href="https://anita.ink"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold text-sm hover:underline ml-4 whitespace-nowrap"
          >
            Visit anita.ink →
          </a>
        </div>

        <h1 className="text-3xl font-bold text-primary text-center mb-6">ANITA</h1>
        <h2 className="text-xl font-bold text-primary text-center mb-6">
          Dollar Cost Averaging
        </h2>

        <img src="/anita_2.png" alt="Anita Logo" className="w-24 mx-auto mb-4" />

        {walletConnected ? (
          <button
            onClick={disconnectWallet}
            className="w-full mb-4 py-2 bg-red-600 text-white rounded-lg cursor-pointer hover:bg-red-700 hover:shadow-lg transition duration-200 ease-in-out"
          >
            Disconnect Wallet
          </button>
        ) : (
          <button
            onClick={connectWallet}
            className="w-full mb-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-purple-700 hover:shadow-lg transition duration-200 ease-in-out"
          >
            Connect Wallet
          </button>
        )}

        {walletConnected && walletAddress && (
          <div className="mb-4 border border-primary text-sm text-gray-700 text-center rounded-lg p-2 bg-purple-50">
            Connected: <span className="font-mono text-primary">{formatAddress(walletAddress)}</span>
          </div>
        )}

        {/* TABS */}
        {walletConnected && (
          <>
            <div className="mb-6 flex gap-4 justify-center">
              <button
                onClick={() => setActiveTab("register")}
                className={`px-4 py-2 rounded ${
                  activeTab === "register"
                    ? "bg-purple-700 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                Register
              </button>
              <button
                onClick={() => setActiveTab("activeSession")}
                disabled={!dcaInfo}
                className={`px-4 py-2 rounded ${
                  activeTab === "activeSession"
                    ? "bg-purple-700 text-white"
                    : "bg-gray-200 text-gray-700"
                } ${!dcaInfo ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Active Session
              </button>
              <button
                onClick={() => setActiveTab("history")}
                disabled={!dcaInfo}
                className={`px-4 py-2 rounded ${
                  activeTab === "history"
                    ? "bg-purple-700 text-white"
                    : "bg-gray-200 text-gray-700"
                } ${!dcaInfo ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                DCA History
              </button>
            </div>

            {/* REGISTER TAB */}
            {activeTab === "register" && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Amount per day (ETH)</label>
                  <input
                    type="number"
                    min="0.00005"
                    step="0.0001"
                    value={amountPerDay}
                    onChange={(e) => setAmountPerDay(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">Total DCA Days</label>
                  <input
                    type="number"
                    min="1"
                    value={daysLeft}
                    onChange={(e) => setDaysLeft(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">ETH Allocation (≈)</label>
                  <input
                    type="text"
                    disabled
                    value={isNaN(totalETH) ? "" : totalETH.toFixed(5)}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">Estimated Fee (0.1%)</label>
                  <input
                    type="text"
                    disabled
                    value={amountPerDay && daysLeft && calculatedFee ? calculatedFee : "—"}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700">Daily Buy Time (UTC)</label>
                  <div className="relative">
                    <select
                      value={buyTime}
                      onChange={(e) => setBuyTime(e.target.value)}
                      className="w-full mt-1 px-3 py-2 pr-10 border rounded-md appearance-none bg-white"
                    >
                      {Array.from({ length: 96 }, (_, i) => {
                        const hour = Math.floor(i / 4);
                        const minute = (i % 4) * 15;
                        const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
                        return (
                          <option key={timeString} value={timeString}>
                            {timeString}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <button
                  onClick={register}
                  className="w-full py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-purple-700 hover:shadow-lg transition duration-200 ease-in-out"
                >
                  Start DCA
                </button>

                <div className="mt-6 text-center text-sm text-gray-700 min-h-[2rem]">
                  {status && (
                    <div className="mt-6 border border-primary text-sm text-center text-gray-700 rounded-lg p-3 bg-purple-50 flex items-center justify-center gap-2">
                      {loading && status.startsWith("⏳") && <FaSpinner className="animate-spin" />}
                      <span>{status}</span>
                    </div>
                  )}
                </div>

              </>
            )}

            {/* ACTIVE SESSION TAB */}
            {activeTab === "activeSession" && (
                <div>
                
                {dcaInfo && (
                    <div className="mt-8 border border-purple-300 rounded-lg p-4 bg-purple-50 shadow-inner">
                      <h2 className="text-lg font-semibold text-purple-800 mb-2">🪙 Active DCA Session</h2>
                      <p className="text-gray-700">
                        Daily Amount: <strong>{dcaInfo.amountPerDay} ETH</strong>
                      </p>
                      <p className="text-gray-700">
                        Days Left: <strong>{dcaInfo.daysLeft}</strong>
                      </p>
                      <p className="text-gray-700">
                        Refundable Total:{" "}
                        <strong>{(parseFloat(dcaInfo.amountPerDay) * dcaInfo.daysLeft).toFixed(5)} ETH</strong>
                      </p>

                      <button
                        onClick={stopDCA}
                        disabled={stopping}
                        className="mt-4 w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {stopping ? "Stopping..." : "Stop & Refund"}
                      </button>
                    </div>
                )}

              </div>
              
              
            )}

            {/* DCA HISTORY TAB */}
            {activeTab === "history" && (
                <div className="max-h-64 overflow-auto border border-gray-300 rounded p-4 bg-gray-50">
                  
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">🛒 Purchases History </h2>

                  {fetchingPurchases ? (
                    <p>Loading purchases...</p>
                  ) : !dcaInfo ? (
                    <p className="text-gray-600">No active DCA session</p>
                  ) : activePurchases.length === 0 ? (
                    <p className="text-gray-600">No purchases executed yet</p>
                  ) : (
                    <ul className="space-y-3">
                      {activePurchases.map(({ amount, txHash, datetime }, i) => (
                        <li
                          key={i}
                          className="border border-gray-300 rounded p-3 bg-white shadow-sm"
                        >
                          <p>
                            <strong>Amount:</strong> {amount} ETH
                          </p>
                          <p>
                            <strong>Executed At:</strong> {datetime}
                          </p>
                          <a
                            href={`https://explorer.inkonchain.com/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            View Tx
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}

                </div>
            )}
          </>
        )}
      </div>
      <ToastContainer />
      <SpeedInsights />
    </div>
  );

}
