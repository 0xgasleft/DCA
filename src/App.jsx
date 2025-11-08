import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { toast, Toaster } from 'sonner';
import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { FaSpinner } from "react-icons/fa";


import LandingPage from "./pages/LandingPage.jsx";
import ConnectWalletPage from "./pages/ConnectWalletPage.jsx";
import TokenSelectionPage from "./pages/TokenSelectionPage.jsx";
import DCAConfigPage from "./pages/DCAConfigPage.jsx";
import VisualizerPage from "./pages/VisualizerPage.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";


import { CONTRACT_ABI, ERC20_ABI, CONTRACT_ADDRESS } from "../lib/constants.js";
import { TOKENS } from "../lib/tokens.config.js";
import { formatNumber } from "../lib/utils.js";
import { formatPriceImpact, getPriceImpactSeverity } from "../lib/priceImpact.js";


const RPC_URL = import.meta.env.VITE_RPC_URL;


const LOCAL_HARDHAT_CHAIN = {
  chainId: "0x7a69", // 31337
  chainName: "Hardhat Local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [],
};

const INK_CHAIN = {
  chainId: "0xdef1", // 57073
  chainName: "Ink",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ["https://explorer.inkonchain.com"],
};


const TARGET_CHAIN = import.meta.env?.VITE_RPC_URL?.includes("127.0.0.1")
  ? LOCAL_HARDHAT_CHAIN
  : INK_CHAIN;

const switchToInk = async () => {
  const chainId = TARGET_CHAIN.chainId;

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
              params: [TARGET_CHAIN],
            });
          } catch (addError) {
            throw new Error(`Could not add ${TARGET_CHAIN.chainName} chain`);
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

export default function App() {
  inject();

  // Check if we're on the visualizer route
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);

  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [showConnectPage, setShowConnectPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amountPerDay, setAmountPerDay] = useState("");
  const [daysLeft, setDaysLeft] = useState("");
  const [status, setStatus] = useState("");
  const [buyTime, setBuyTime] = useState("00:00");
  const [minFee, setMinFee] = useState(null);
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [dcaSessions, setDcaSessions] = useState([]);
  const [stopping, setStopping] = useState(false);
  const [stoppingToken, setStoppingToken] = useState(null);
  const [activePurchases, setActivePurchases] = useState([]);
  const [activeTab, setActiveTab] = useState("register");
  const [fetchingPurchases, setFetchingPurchases] = useState(false);


  const [selectedTokenPair, setSelectedTokenPair] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalGranted, setApprovalGranted] = useState(false);
  const [isExemptedFromFees, setIsExemptedFromFees] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isConnecting, setIsConnecting] = useState(false); // Flag to prevent auto-connect during signature

  const provider = window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null;
  const contract = provider ? new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider) : null;
  const formatAddress = (addr) => addr.slice(0, 6) + "..." + addr.slice(-4);

  // Handle route changes
  useEffect(() => {
    const handleRouteChange = () => {
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  useEffect(() => {
    const checkStoredSession = () => {
      const storedSession = localStorage.getItem("dca_session");
      if (!storedSession) return;

      try {
        const { address, timestamp } = JSON.parse(storedSession);
        const sessionAge = Date.now() - timestamp;
        const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

        if (sessionAge > SESSION_EXPIRY) {
          localStorage.removeItem("dca_session");
          return;
        }
      } catch (err) {
        console.error("Session check failed:", err);
        localStorage.removeItem("dca_session");
      }
    };

    checkStoredSession();
  }, []);


  const calculateNextPurchaseProgress = (buyTimeUTC) => {

    if (buyTimeUTC === null || buyTimeUTC === undefined) {
      return { progressPercent: 0, timeString: 'N/A', buyTimeFormatted: 'N/A', buyTimeUTC: 'N/A' };
    }


    const now = new Date();

    const buyHoursUTC = Math.floor(buyTimeUTC / 100);
    const buyMinutesUTC = buyTimeUTC % 100;


    const todayBuyTimeUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      buyHoursUTC,
      buyMinutesUTC,
      0,
      0
    ));


    const buyHoursLocal = todayBuyTimeUTC.getHours();
    const buyMinutesLocal = todayBuyTimeUTC.getMinutes();


    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const buyTimeInMinutes = buyHoursLocal * 60 + buyMinutesLocal;


    let minutesUntilNext;

    if (currentTimeInMinutes < buyTimeInMinutes) {

      minutesUntilNext = buyTimeInMinutes - currentTimeInMinutes;
    } else if (currentTimeInMinutes === buyTimeInMinutes) {

      minutesUntilNext = 0;
    } else {

      const minutesUntilMidnight = (24 * 60) - currentTimeInMinutes;
      minutesUntilNext = minutesUntilMidnight + buyTimeInMinutes;
    }


    const totalMinutesInDay = 24 * 60;
    const minutesSinceLastPurchase = totalMinutesInDay - minutesUntilNext;
    const progressPercent = (minutesSinceLastPurchase / totalMinutesInDay) * 100;


    let timeString;
    if (minutesUntilNext === 0) {
      timeString = 'Executing now';
    } else if (minutesUntilNext < 60) {
      timeString = `In ${minutesUntilNext}m`;
    } else {
      const hoursUntil = Math.floor(minutesUntilNext / 60);
      const minutesRemaining = minutesUntilNext % 60;

      if (minutesRemaining === 0) {
        timeString = `In ${hoursUntil}h`;
      } else {
        timeString = `In ${hoursUntil}h ${minutesRemaining}m`;
      }
    }


    const buyTimeFormatted = `${String(buyHoursLocal).padStart(2, '0')}:${String(buyMinutesLocal).padStart(2, '0')}`;

    return {
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
      timeString,
      buyTimeFormatted,
      buyTimeUTC: `${String(buyHoursUTC).padStart(2, '0')}:${String(buyMinutesUTC).padStart(2, '0')} UTC`
    };
  };


  const handleTokenSelectionChange = useCallback((selection) => {


    const sourceToken = TOKENS[selection.sourceKey];
    const destinationToken = TOKENS[selection.destinationKey];

    setSelectedTokenPair({
      ...selection,
      source: sourceToken,
      destination: destinationToken
    });
    setAmountPerDay("");
    setDaysLeft("");
    setCalculatedFee(null);
    setNeedsApproval(false);
    setTokenBalance(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (isConnecting) return;

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
  }, [isConnecting]);

  useEffect(() => {
    if (!provider || !contract || !selectedTokenPair) return;

    const loadMinFee = async () => {
      try {

        const directProvider = new ethers.JsonRpcProvider(RPC_URL);
        const directContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, directProvider);

        const { source } = selectedTokenPair;

        const sourceTokenAddress = source.isNative ? ethers.ZeroAddress : source.address;


        const feeWei = await directContract.getTokenMinFee(sourceTokenAddress);


        const feeFormatted = Number(ethers.formatUnits(feeWei, source.decimals || 18));
        setMinFee(feeFormatted);

        console.log(`Loaded min fee for ${source.symbol}: ${feeFormatted}`);
      } catch (err) {
        console.error("Error loading token fee:", err);

        const isETH = selectedTokenPair.source.isNative;
        setMinFee(isETH ? 0.00005 : 0.2);
      }
    };

    loadMinFee();
  }, [provider, contract, selectedTokenPair]);


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    if (!amountPerDay || !daysLeft || minFee === null || !selectedTokenPair) {
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

    const { source } = selectedTokenPair;
    const finalFee = Math.max(fee, minFee);
    const tokenSymbol = source.symbol || "tokens";
    setCalculatedFee(`${finalFee.toFixed(5)} ${tokenSymbol}`);
  }, [amountPerDay, daysLeft, minFee, selectedTokenPair]);


  useEffect(() => {
    if (!walletConnected || !selectedTokenPair || !walletAddress) {
      setTokenBalance(null);
      return;
    }

    const checkBalance = async () => {
      try {
        const directProvider = new ethers.JsonRpcProvider(RPC_URL);
        const { source } = selectedTokenPair;

        if (source.isNative) {
          const balance = await directProvider.getBalance(walletAddress);
          setTokenBalance(ethers.formatEther(balance));
        } else {
          const tokenContract = new ethers.Contract(source.address, ERC20_ABI, directProvider);
          const balance = await tokenContract.balanceOf(walletAddress);
          setTokenBalance(ethers.formatUnits(balance, source.decimals));
        }
      } catch (err) {
        console.error("Error checking balance:", err);
      }
    };

    checkBalance();
  }, [walletConnected, selectedTokenPair, walletAddress]);


  useEffect(() => {
    if (!walletConnected || !selectedTokenPair || !walletAddress) {
      setNeedsApproval(false);
      return;
    }

    const checkApproval = async () => {
      try {
        const directProvider = new ethers.JsonRpcProvider(RPC_URL);
        const directContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, directProvider);
        const { source } = selectedTokenPair;


        if (source.isNative) {
          setNeedsApproval(false);
          return;
        }

        const tokenContract = new ethers.Contract(source.address, ERC20_ABI, directProvider);


        let totalAmount;
        if (amountPerDay && daysLeft && minFee !== null) {
          const dcaAmount = ethers.parseUnits(
            (parseFloat(amountPerDay) * parseInt(daysLeft)).toString(),
            source.decimals
          );

          // Calculate fee (0 if user is exempted)
          let feeAmount = BigInt(0);

          if (!isExemptedFromFees) {
            const sourceTokenAddress = source.isNative ? ethers.ZeroAddress : source.address;
            const minFeeWei = await directContract.getTokenMinFee(sourceTokenAddress);
            const zeroPointOnePercent = dcaAmount / BigInt(1000);
            feeAmount = zeroPointOnePercent > minFeeWei ? zeroPointOnePercent : minFeeWei;
          }

          totalAmount = dcaAmount + feeAmount;
        } else {

          totalAmount = ethers.parseUnits("1", source.decimals);
        }

        const allowance = await tokenContract.allowance(walletAddress, CONTRACT_ADDRESS);
        setNeedsApproval(allowance < totalAmount);
      } catch (err) {
        console.error("Error checking approval:", err);
        setNeedsApproval(true);
      }
    };

    checkApproval();
  }, [walletConnected, selectedTokenPair, walletAddress, amountPerDay, daysLeft, minFee, isExemptedFromFees]);

  useEffect(() => {
    if (walletConnected) {
      fetchDcaInfo();
    }
  }, [walletConnected]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      checkFeeExemptionStatus();
    }
  }, [walletConnected, walletAddress]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchActivePurchases(walletAddress);
    } else {
      setActivePurchases([]);
    }
  }, [walletConnected, walletAddress]);

  useEffect(() => {
    if (dcaSessions.length > 0 && activeTab === "register") {
      setActiveTab("activeSession");
    }
  }, [dcaSessions.length]);

  const checkFeeExemptionStatus = async () => {
    if (!walletAddress) return;

    try {
      const directProvider = new ethers.JsonRpcProvider(RPC_URL);
      const directContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, directProvider);
      const exempted = await directContract.isExemptedFromFees(walletAddress);
      setIsExemptedFromFees(exempted);
    } catch (err) {
      console.warn("Failed checking fee exemption status:", err.message);
      setIsExemptedFromFees(false);
    }
  };

  const fetchDcaInfo = async () => {
    if (!walletAddress) return;

    try {

      const directProvider = new ethers.JsonRpcProvider(RPC_URL);
      const directContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, directProvider);


      let userTokens = [];
      try {
        userTokens = await directContract.getUserDestinationTokens(walletAddress);

        if (!Array.isArray(userTokens)) {
          userTokens = [];
        }
      } catch (err) {

        console.warn("Could not fetch user destination tokens:", err.message);
        console.warn("This is expected if user has no active DCA sessions");
        userTokens = [];
      }

      const sessions = [];
      for (const destinationToken of userTokens) {
        try {
          const config = await directContract.getDCAConfig(walletAddress, destinationToken);

          if (config.days_left > 0) {

            let sourceDecimals = 18;
            if (!config.isNativeETH) {

              for (const [_, tokenData] of Object.entries(TOKENS)) {
                if (tokenData.address?.toLowerCase() === config.sourceToken.toLowerCase()) {
                  sourceDecimals = tokenData.decimals || 18;
                  break;
                }
              }
            }

            const formattedAmount = parseFloat(
              ethers.formatUnits(config.amount_per_day, sourceDecimals)
            ).toFixed(5);

            sessions.push({
              destinationToken: destinationToken,
              sourceToken: config.sourceToken,
              amountPerDay: formattedAmount,
              daysLeft: Number(config.days_left),
              isNativeETH: config.isNativeETH,
              buyTime: Number(config.buy_time),
            });
          }
        } catch (err) {
          console.warn(`Could not fetch config for token ${destinationToken}:`, err.message);
        }
      }

      setDcaSessions(sessions);
      checkFeeExemptionStatus();
    } catch (err) {
      console.error("Failed fetching DCA info", err);
      setDcaSessions([]);
    }
  };

  const fetchActivePurchases = async (address) => {
    if (!address) return;

    setFetchingPurchases(true);
    try {

      const res = await fetch(`/api/get-purchase-history?address=${address}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch purchase history: ${res.statusText}`);
      }

      const purchases = await res.json();
      setActivePurchases(purchases);
    } catch (err) {
      console.error("Failed to fetch purchase events", err);
      setActivePurchases([]);
    }
    setFetchingPurchases(false);
  };

  const connectWallet = async () => {
    if (!window.ethereum) return toast.error("Please install MetaMask/Rabby");

    setIsConnecting(true);
    try {

      await provider.send("eth_requestAccounts", []);
      await switchToInk();

      const signer = await provider.getSigner();
      const address = await signer.getAddress();


      const message = `Welcome to DCA on Ink!\n\nSign this message to prove you own this wallet address.\n\nAddress: ${address}\nTimestamp: ${new Date().toISOString()}\n\nThis signature will not trigger any blockchain transaction or cost any gas fees.`;

      toast.info("Please sign the message in your wallet to verify ownership...", { duration: 5000 });

      let signature;
      try {
        signature = await signer.signMessage(message);
      } catch (signErr) {

        console.error("Signature rejected:", signErr);
        toast.error("Signature rejected. Please sign the message to connect.");
        setIsConnecting(false);
        return;
      }


      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        toast.error("Signature verification failed. Please try again.");
        setIsConnecting(false);
        return;
      }


      setWalletConnected(true);
      setWalletAddress(address);

      localStorage.setItem("dca_session", JSON.stringify({
        address: address,
        timestamp: Date.now()
      }));

      toast.success("Signed in successfully!");
      setStatus(`Wallet connected and switched to ${TARGET_CHAIN.chainName}`);
    } catch (err) {
      console.error(err);
      toast.error("Wallet connection or chain switch failed");
      setStatus("Wallet connection or chain switch failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    localStorage.removeItem("dca_session");
    setWalletConnected(false);
    setWalletAddress("");
    setShowConnectPage(false);
    setAmountPerDay("");
    setDaysLeft("");
    setBuyTime("00:00");
    setCalculatedFee(null);
    setDcaSessions([]);
    setStatus("");
    setMinFee(null);
    setSelectedTokenPair(null);
    setTokenBalance(null);
    setNeedsApproval(false);
  };

  const approveToken = async (formData) => {

    const amount = formData?.amountPerDay || amountPerDay;
    const days = formData?.daysLeft || daysLeft;

    if (!selectedTokenPair || !amount || !days) {
      return toast.error("Invalid parameters");
    }

    if (minFee === null) {
      return toast.error("Fee not loaded yet, please wait");
    }

    setApproving(true);
    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      const { source } = selectedTokenPair;

      const tokenContract = new ethers.Contract(source.address, ERC20_ABI, signer);


      const dcaTotal = ethers.parseUnits(
        (parseFloat(amount) * parseInt(days)).toString(),
        source.decimals
      );


      let fee = BigInt(0);

      if (!isExemptedFromFees) {
        const sourceTokenAddress = source.isNative ? ethers.ZeroAddress : source.address;
        const minFeeWei = await contractWithSigner.getTokenMinFee(sourceTokenAddress);
        const zeroPointOnePercent = dcaTotal / BigInt(1000);
        fee = zeroPointOnePercent > minFeeWei ? zeroPointOnePercent : minFeeWei;
      }

      const totalApproval = dcaTotal + fee;

      // Check current allowance first
      const userAddress = await signer.getAddress();
      const currentAllowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESS);

      if (currentAllowance >= totalApproval) {
        // Already approved!
        setApprovalGranted(true);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Show green button for 1.5s
        toast.success("Approval already granted!");
        setNeedsApproval(false);
        setApprovalGranted(false);
        setApproving(false);
        return;
      }

      // Need to approve
      if (isExemptedFromFees) {
        console.log(`Approving ${ethers.formatUnits(totalApproval, source.decimals)} ${source.symbol} (DCA only, no fee - wallet is exempt)`);
      } else {
        console.log(`Approving ${ethers.formatUnits(totalApproval, source.decimals)} ${source.symbol} (DCA: ${ethers.formatUnits(dcaTotal, source.decimals)} + Fee: ${ethers.formatUnits(fee, source.decimals)})`);
      }

      const tx = await tokenContract.approve(CONTRACT_ADDRESS, totalApproval);

      await toast.promise(
        tx.wait(),
        {
          loading: 'Waiting for approval confirmation...',
          success: 'Approval successful!',
          error: 'Approval failed'
        }
      );

      // Transaction confirmed - show green button animation
      setApprovalGranted(true);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Show green button for 1.5s
      setNeedsApproval(false);
      setApprovalGranted(false);
    } catch (err) {
      console.error(err);
      toast.error("Approval failed: " + (err.message || "Unknown error"));
    } finally {
      setApproving(false);
    }
  };

  const register = async (amount = amountPerDay, days = daysLeft, time = buyTime) => {
    if (!walletConnected) return toast.warning("Connect wallet first");
    if (!selectedTokenPair) return toast.error("Select token pair first");
    if (!amount || !days || !time) return toast.error("All fields are required");

    const minAmount = 0.00005;
    if (parseFloat(amount) < minAmount) {
      return toast.error(`Amount per day must be at least ${minAmount}`);
    }

    if (parseInt(days) <= 0 || parseInt(days) > 365) {
      return toast.error("Days must be between 1 and 365");
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
      return toast.error("Buy time must be in HH:MM format");
    }
    const [hour, minute] = time.split(":").map(Number);
    if (hour > 23 || minute > 59) {
      return toast.error("Invalid buy time value");
    }

    if (needsApproval) {
      return toast.error("Please approve token spending first");
    }

    try {
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const contractWithSigner = contract.connect(signer);

      const { source, destination } = selectedTokenPair;


      const existingConfig = await contractWithSigner.getDCAConfig(userAddress, destination.address);
      if (existingConfig.amount_per_day > 0) {
        return toast.error(`Already have an active DCA for ${destination.symbol}. Stop it first before creating a new one.`);
      }

      const amountWei = ethers.parseUnits(amount, source.decimals);
      const daysNum = BigInt(days);

      const now = new Date();
      const localDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        minute,
        0,
        0
      );

      const utcHours = localDate.getUTCHours();
      const utcMinutes = localDate.getUTCMinutes();

      const buyTimeInt = utcHours * 100 + utcMinutes;

      console.log(`Local time: ${time} -> UTC time: ${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')} (${buyTimeInt})`);

      setLoading(true);
      setStatus("⏳ Registering... (please wait)");

      let tx;

      if (source.isNative) {

        const dcaTotal = amountWei * daysNum;
        let total = dcaTotal;

        // Only add fee if user is NOT exempted
        if (!isExemptedFromFees) {
          const zeroPointOnePercent = dcaTotal / BigInt(1000);
          const minFeeWei = ethers.parseEther(minFee != null ? minFee.toFixed(18) : "0.00005");
          const fee = zeroPointOnePercent > minFeeWei ? zeroPointOnePercent : minFeeWei;
          total = dcaTotal + fee;
          console.log(`Registering with fee: ${ethers.formatEther(fee)} ETH`);
        } else {
          console.log(`Registering without fee (wallet is exempt)`);
        }

        tx = await contractWithSigner.registerForDCAWithETH(
          destination.address,
          amountWei,
          daysNum,
          buyTimeInt,
          { value: total }
        );
      } else {



        tx = await contractWithSigner.registerForDCAWithToken(
          source.address,
          destination.address,
          amountWei,
          daysNum,
          buyTimeInt
        );
      }

      const receipt = await tx.wait();

      const registrationData = {
        address: userAddress,
        buy_time: time,
        source_token: source.address,
        destination_token: destination.address,
        tx_hash: receipt.hash
      };

      const res = await fetch("/api/register-dca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });

      if (!res.headers.get("Content-Type")?.includes("application/json")) {
        console.error("Unexpected response format:", res.headers.get("Content-Type"));
        throw new Error("Error occurred while registering DCA");
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Backend registration failed");
      }


      fetchDcaInfo();

      setStatus("Registered successfully!");
      toast.success(`DCA registered successfully! Executing daily at ${time}`);


      setAmountPerDay("");
      setDaysLeft("");
      setBuyTime("00:00");


      setSelectedTokenPair(null);

      setLoading(false);

    } catch (err) {
      console.error(err);

      const reason =
        err?.revert?.args?.[0] ??
        err?.shortMessage ??
        err?.message ??
        "Transaction failed";

      setStatus(reason);
      setLoading(false);
    }
  };

  const stopDCA = async (destinationToken) => {
    setStopping(true);
    setStoppingToken(destinationToken);
    try {
      const signer = await provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      const tx = await contractWithSigner.giveUpDCA(destinationToken);

      await toast.promise(
        tx.wait(),
        {
          loading: 'Stopping DCA session...',
          success: 'DCA session stopped! You can now register a new DCA.',
          error: 'Failed to stop DCA'
        }
      );


      setDcaSessions(prev => prev.filter(s => s.destinationToken !== destinationToken));



      if (selectedTokenPair && selectedTokenPair.destination.address.toLowerCase() === destinationToken.toLowerCase()) {
        setAmountPerDay("");
        setDaysLeft("");
        setBuyTime("00:00");

      }
    } catch (err) {
      console.error(err);
    }
    setStopping(false);
    setStoppingToken(null);
  };

  const handleSubmitDCA = async (formData) => {
    const { amountPerDay: amount, daysLeft: days, buyTime: time } = formData;

    setAmountPerDay(amount);
    setDaysLeft(days);
    setBuyTime(time);


    await register(amount, days, time);
  };

  const handleBackToSelection = () => {
    setSelectedTokenPair(null);
    setAmountPerDay("");
    setDaysLeft("");
    setBuyTime("00:00");
    setCalculatedFee(null);
    setStatus("");
  };

  const handleConnectClick = async () => {
    if (walletConnected) {
      return;
    }

    const storedSession = localStorage.getItem("dca_session");
    if (storedSession) {
      try {
        const { address, timestamp } = JSON.parse(storedSession);
        const sessionAge = Date.now() - timestamp;
        const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

        if (sessionAge < SESSION_EXPIRY && window.ethereum) {
          const accounts = await provider.send("eth_requestAccounts", []);
          if (accounts[0].toLowerCase() === address.toLowerCase()) {
            await switchToInk();
            setWalletConnected(true);
            setWalletAddress(address);
            return;
          }
        }
        localStorage.removeItem("dca_session");
      } catch (err) {
        console.error("Session restore failed:", err);
        localStorage.removeItem("dca_session");
      }
    }

    setShowConnectPage(true);
  };


  // If we're on the visualizer route, show visualizer page
  if (currentRoute === '/visualizer') {
    return (
      <>
        <Toaster position="top-center" richColors closeButton />
        <SpeedInsights />
        <VisualizerPage />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <SpeedInsights />
      {!walletConnected ? (
        showConnectPage ? (
          <ConnectWalletPage
            onConnect={connectWallet}
            onBack={() => setShowConnectPage(false)}
          />
        ) : (
          <LandingPage onConnect={handleConnectClick} />
        )
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 transition-colors duration-200">
      {/* Header with wallet info and disconnect */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
          {/* Logo */}
          <button
            onClick={disconnectWallet}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            title="Return to landing page"
          >
            <img src="/ink_dca_logo.png" alt="DCA on Ink" className="w-10 h-10" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">DCA on <span className="text-purple-600 dark:text-purple-400">Ink</span></span>
          </button>

          {/* Wallet Info and Theme Toggle */}
          <div className="flex items-center gap-4">
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://t.me/+qzZO0ePqZts3YmQ0"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                aria-label="Telegram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                </svg>
              </a>
              <a
                href="https://x.com/ink_dca"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
            <ThemeToggle />
            <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
              <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">Connected:</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">{formatAddress(walletAddress)}</span>
            </div>
            <button
              onClick={disconnectWallet}
              className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors font-medium"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-center bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-4 shadow-lg border border-purple-100 dark:border-gray-600">
          <button
            onClick={() => setActiveTab("register")}
            className={`group relative px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
              activeTab === "register"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-300 dark:shadow-purple-900/50"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-600 hover:border-purple-300 dark:hover:border-purple-500 shadow-md hover:shadow-xl border border-purple-200 dark:border-gray-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className={`w-6 h-6 transition-colors ${activeTab === "register" ? "text-white" : "text-purple-600 group-hover:text-purple-700"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-base font-bold leading-tight">Register DCA</div>
                <div className={`text-xs leading-tight mt-0.5 ${activeTab === "register" ? "text-purple-100" : "text-gray-500 group-hover:text-purple-600"}`}>Create new strategy</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("activeSession")}
            disabled={dcaSessions.length === 0}
            className={`group relative px-6 py-4 rounded-xl font-semibold transition-all duration-300 ${
              dcaSessions.length === 0
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-2 border-dashed border-gray-300 dark:border-gray-600 opacity-60"
                : activeTab === "activeSession"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-300 dark:shadow-purple-900/50 transform hover:scale-105"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-600 hover:border-purple-300 dark:hover:border-purple-500 shadow-md hover:shadow-xl border border-purple-200 dark:border-gray-600 transform hover:scale-105"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <svg className={`w-6 h-6 transition-colors ${dcaSessions.length === 0 ? "text-gray-400 dark:text-gray-500" : activeTab === "activeSession" ? "text-white" : "text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {dcaSessions.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-green-500 dark:bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-md">
                    {dcaSessions.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="text-base font-bold leading-tight">Active Strategies</div>
                <div className={`text-xs leading-tight mt-0.5 transition-colors ${dcaSessions.length === 0 ? "text-gray-400 dark:text-gray-500" : activeTab === "activeSession" ? "text-purple-100" : "text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-300"}`}>
                  {dcaSessions.length > 0 ? `${dcaSessions.length} running` : "No active DCAs"}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            disabled={activePurchases.length === 0}
            className={`group relative px-6 py-4 rounded-xl font-semibold transition-all duration-300 ${
              activePurchases.length === 0
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border-2 border-dashed border-gray-300 dark:border-gray-600 opacity-60"
                : activeTab === "history"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-300 dark:shadow-purple-900/50 transform hover:scale-105"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-600 hover:border-purple-300 dark:hover:border-purple-500 shadow-md hover:shadow-xl border border-purple-200 dark:border-gray-600 transform hover:scale-105"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <svg className={`w-6 h-6 transition-colors ${activePurchases.length === 0 ? "text-gray-400 dark:text-gray-500" : activeTab === "history" ? "text-white" : "text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {activePurchases.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-500 dark:bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-md">
                    {activePurchases.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="text-base font-bold leading-tight">DCA History</div>
                <div className={`text-xs leading-tight mt-0.5 transition-colors ${activePurchases.length === 0 ? "text-gray-400 dark:text-gray-500" : activeTab === "history" ? "text-purple-100" : "text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-300"}`}>
                  {activePurchases.length > 0 ? `${activePurchases.length} purchases` : "No purchases yet"}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {/* REGISTER TAB */}
        {activeTab === "register" && (
          <>
            {!selectedTokenPair ? (
              <TokenSelectionPage onSelectDCA={handleTokenSelectionChange} />
            ) : (
              <DCAConfigPage
                selectedPair={selectedTokenPair}
                onBack={handleBackToSelection}
                onSubmit={handleSubmitDCA}
                tokenBalance={tokenBalance}
                needsApproval={needsApproval}
                onApprove={approveToken}
                approving={approving}
                approvalGranted={approvalGranted}
                loading={loading}
                status={status}
                minFee={minFee}
                isExemptedFromFees={isExemptedFromFees}
              />
            )}
          </>
        )}

        {/* ACTIVE SESSION TAB */}
        {activeTab === "activeSession" && (
          <div className="max-w-6xl mx-auto px-4">
            {dcaSessions.length > 0 ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Active Strategies</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{dcaSessions.length} active DCA {dcaSessions.length === 1 ? 'position' : 'positions'}</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 px-6 py-3 rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-purple-700 dark:text-purple-300 font-semibold">Auto-investing</span>
                  </div>
                </div>

                {/* Sessions Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {dcaSessions.map((session) => {

                    const destToken = Object.entries(TOKENS).find(
                      ([_, token]) => token.address?.toLowerCase() === session.destinationToken.toLowerCase()
                    );
                    const destTokenName = destToken?.[0] || session.destinationToken.slice(0, 6);
                    const destTokenLogo = destToken?.[1]?.logo;

                    const sourceToken = session.isNativeETH
                      ? ["ETH", TOKENS.ETH]
                      : Object.entries(TOKENS).find(
                          ([_, token]) => token.address?.toLowerCase() === session.sourceToken.toLowerCase()
                        );
                    const sourceTokenName = sourceToken?.[0] || session.sourceToken.slice(0, 6);
                    const sourceTokenLogo = sourceToken?.[1]?.logo;

                    const totalRemaining = (parseFloat(session.amountPerDay) * session.daysLeft).toFixed(5);



                    const purchaseProgress = (session.buyTime !== null && session.buyTime !== undefined)
                      ? calculateNextPurchaseProgress(session.buyTime)
                      : { progressPercent: 0, timeString: 'N/A', buyTimeFormatted: 'N/A' };


                    void currentTime;

                    return (
                      <div
                        key={session.destinationToken}
                        className="bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-3xl border-2 border-purple-200 dark:border-gray-600 p-6 shadow-xl dark:shadow-gray-900/50 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                      >
                        {/* Token Pair Header */}
                        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-purple-200 dark:border-gray-600">
                          <div className="flex items-center -space-x-3">
                            {sourceTokenLogo ? (
                              <img
                                src={sourceTokenLogo}
                                alt={sourceTokenName}
                                className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                                onError={(e) => {
                                  console.error(`Failed to load source token logo: ${sourceTokenLogo}`);
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-700 shadow-md bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300">
                                {sourceTokenName.slice(0, 2)}
                              </div>
                            )}
                            {destTokenLogo ? (
                              <img
                                src={destTokenLogo}
                                alt={destTokenName}
                                className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-700 shadow-md"
                                onError={(e) => {
                                  console.error(`Failed to load dest token logo: ${destTokenLogo}`);
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-700 shadow-md bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-xs font-bold text-pink-600 dark:text-pink-300">
                                {destTokenName.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {sourceTokenName} → {destTokenName}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Dollar Cost Averaging</p>
                          </div>
                          <div className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                            <span className="text-green-700 dark:text-green-400 text-xs font-semibold">● Active</span>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          {/* Daily Amount */}
                          <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-purple-100 dark:border-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Per Day</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(session.amountPerDay)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sourceTokenName}</p>
                          </div>

                          {/* Days Remaining */}
                          <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-purple-100 dark:border-gray-600">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Days Left</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{session.daysLeft}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">remaining</p>
                          </div>

                          {/* Total Value */}
                          <div className="col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              </div>
                              <span className="text-xs font-medium opacity-90">Total Remaining</span>
                            </div>
                            <p className="text-3xl font-bold">{formatNumber(totalRemaining)}</p>
                            <p className="text-xs opacity-90 mt-1">{sourceTokenName} refundable</p>
                          </div>
                        </div>

                        {/* Next Purchase Progress */}
                        <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-purple-100 dark:border-gray-600 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Next Purchase</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Scheduled at <span className="font-semibold">{purchaseProgress.buyTimeFormatted}</span> (your local time)
                              </p>
                            </div>
                            <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{purchaseProgress.timeString}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 h-3 rounded-full transition-all duration-1000 ease-linear"
                              style={{width: `${purchaseProgress.progressPercent}%`}}
                            ></div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => stopDCA(session.destinationToken)}
                          disabled={stopping && stoppingToken === session.destinationToken}
                          className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white font-bold rounded-xl hover:from-red-600 hover:to-red-700 dark:hover:from-red-700 dark:hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg dark:shadow-gray-900/50 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          {stopping && stoppingToken === session.destinationToken ? (
                            <>
                              <FaSpinner className="animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                              </svg>
                              Stop DCA & Claim Refund
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-3xl border-2 border-purple-200 dark:border-gray-600 p-12 shadow-xl dark:shadow-gray-900/50 text-center">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Active Strategies</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Start your DCA journey by creating your first automated investment</p>
                <button
                  onClick={() => setActiveTab("register")}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 shadow-lg dark:shadow-gray-900/50 hover:shadow-xl transition-all duration-200"
                >
                  Create DCA Strategy
                </button>
              </div>
            )}
          </div>
        )}

        {/* DCA HISTORY TAB */}
        {activeTab === "history" && (
          <div className="max-w-6xl mx-auto px-4">
            {fetchingPurchases ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border-2 border-purple-200 dark:border-gray-600 p-12 shadow-xl dark:shadow-gray-900/50 text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 dark:border-purple-400"></div>
                <p className="mt-6 text-gray-600 dark:text-gray-300 text-lg font-medium">Loading purchase history...</p>
              </div>
            ) : activePurchases.length === 0 ? (
              <div className="bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-3xl border-2 border-purple-200 dark:border-gray-600 p-12 shadow-xl dark:shadow-gray-900/50 text-center">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Purchase History Yet</h3>
                <p className="text-gray-500 dark:text-gray-400">Your automated DCA purchases will appear here once they're executed</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Purchase History</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{activePurchases.length} automated {activePurchases.length === 1 ? 'purchase' : 'purchases'}</p>
                  </div>
                </div>

                {/* Purchase Cards */}
                <div className="grid gap-4">
                  {activePurchases.map(({ amountIn, amountOut, sourceToken, destinationToken, txHash, datetime, priceImpact, slippagePercent }, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl border-2 border-purple-200 dark:border-gray-600 p-6 shadow-lg dark:shadow-gray-900/50 hover:shadow-xl transition-all duration-200 hover:scale-[1.01]"
                    >
                      <div className="flex items-start justify-between mb-4">
                        {/* Swap Visual */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col items-center">
                            <div className="bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-xl px-4 py-3 min-w-[120px]">
                              <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">Spent</p>
                              <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatNumber(parseFloat(amountIn))}</p>
                              <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">{sourceToken}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-center">
                            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>

                          <div className="flex flex-col items-center">
                            <div className="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 rounded-xl px-4 py-3 min-w-[120px]">
                              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">Received</p>
                              <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatNumber(parseFloat(amountOut))}</p>
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">{destinationToken}</p>
                            </div>
                          </div>
                        </div>

                        {/* Date Badge */}
                        <div className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
                          <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold">
                            {new Date(datetime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Execution Metrics */}
                      <div className="mt-4 pt-4 border-t border-purple-200 dark:border-gray-600">
                        {priceImpact !== null && priceImpact !== undefined ? (
                          <div className="space-y-3">
                            {/* Header with info */}
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Execution Metrics</h4>
                              <div className="group relative">
                                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                  These are the actual metrics from execution time, which may differ from the expected values shown during registration due to market changes.
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {/* Price Impact */}
                              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                  </svg>
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Price Impact</span>
                                </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-lg font-bold ${
                                  priceImpact > 0 ? 'text-blue-600 dark:text-blue-400' :
                                  priceImpact < 0 ? 'text-orange-600 dark:text-orange-400' :
                                  'text-green-600 dark:text-green-400'
                                }`}>
                                  {formatPriceImpact(priceImpact)}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                  priceImpact > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                  priceImpact < 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                }`}>
                                  {priceImpact > 0 ? 'Gain' : priceImpact < 0 ? 'Loss' : 'Neutral'}
                                </span>
                              </div>
                            </div>

                              {/* Slippage */}
                              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Allowed Slippage</span>
                                </div>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-gray-700 dark:text-gray-200">
                                  {slippagePercent !== null && slippagePercent !== undefined
                                    ? `${slippagePercent}%`
                                    : 'N/A'}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                  slippagePercent !== null && slippagePercent !== undefined
                                    ? (slippagePercent < 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                       slippagePercent < 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300')
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {slippagePercent !== null && slippagePercent !== undefined
                                    ? (slippagePercent < 1 ? 'Low' :
                                       slippagePercent < 3 ? 'Medium' : 'High')
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Execution metrics not available
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              (Purchase made before tracking was enabled)
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-purple-200 dark:border-gray-600 mt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{new Date(datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <a
                          href={`https://explorer.inkonchain.com/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-semibold text-sm transition-colors"
                        >
                          View on Explorer
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
      )}
    </>
  );
}
