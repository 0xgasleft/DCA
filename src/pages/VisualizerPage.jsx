import { useState, useEffect } from "react";


function formatTokenAmount(value) {
  const num = parseFloat(value);
  if (num === 0 || isNaN(num)) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (num >= 1) return num.toFixed(4).replace(/\.?0+$/, '');
  if (num >= 0.001) return num.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  const places = Math.ceil(-Math.log10(num)) + 3;
  return num.toFixed(Math.min(places, 18)).replace(/0+$/, '').replace(/\.$/, '') || '0';
}

function formatUsd(num) {
  if (num == null || !isFinite(num)) return "-";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}k`;
  return `$${num.toFixed(2)}`;
}

function timeAgo(unixSeconds) {
  if (!unixSeconds) return "never";
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function VisualizerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [attemptStats, setAttemptStats] = useState(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [expandedError, setExpandedError] = useState(null);

  const fetchAttemptStats = async (storedPassword) => {
    setLoadingAttempts(true);
    try {
      const response = await fetch("/api/get-dca-attempt-stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: storedPassword, days: 30 })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAttemptStats(result.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch attempt stats:', err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/get-visualization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Authentication failed");
      }

      const vizData = await response.json();
      setData(vizData);
      setIsAuthenticated(true);
      sessionStorage.setItem("vizPassword", password);

      
      await fetchAttemptStats(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const storedPassword = sessionStorage.getItem("vizPassword");
      const response = await fetch("/api/get-visualization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: storedPassword })
      });

      if (!response.ok) {
        throw new Error("Failed to refresh data");
      }

      const vizData = await response.json();
      setData(vizData);

      
      await fetchAttemptStats(storedPassword);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage("Starting sync...");
    try {
      const storedPassword = sessionStorage.getItem("vizPassword");

      let needsMoreSync = true;
      let iteration = 0;

      while (needsMoreSync && iteration < 50) {
        iteration++;

        const response = await fetch("/api/sync-visualization", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password: storedPassword })
        });

        if (!response.ok) {
          throw new Error("Sync failed");
        }

        const result = await response.json();

        if (result.needsMoreSync) {
          setSyncMessage(`Synced ${result.blocksSynced} blocks. ${result.remainingBlocks} remaining...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          setSyncMessage("Sync completed!");
          needsMoreSync = false;
        }
      }

      await handleRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(""), 3000);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setData(null);
    setPassword("");
    sessionStorage.removeItem("vizPassword");
  };

  useEffect(() => {
    const storedPassword = sessionStorage.getItem("vizPassword");
    if (storedPassword) {
      setPassword(storedPassword);
      handleAuth({ preventDefault: () => {} });
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                InkDCA Visualizer
              </h1>
              <p className="text-gray-600">
                Enter password to access analytics dashboard
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Authenticating..." : "Access Dashboard"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const {
    overview, sourceTokenVolumes, destinationTokenVolumes, dailyActivity, tokenPairs, metadata,
    activeSessionsByToken = [], buyTimeHistogram = [], slippageStats, priceImpactStats, symbolMap = {},
    revenue = null, treasury = null
  } = data;

  const cronStaleSeconds = overview.lastExecutionTimestamp
    ? Math.floor(Date.now() / 1000) - overview.lastExecutionTimestamp
    : null;
  const cronHealthy = cronStaleSeconds !== null && cronStaleSeconds < 3600;
  const cronWarn = cronStaleSeconds !== null && cronStaleSeconds < 6 * 3600;

  const maxBuyTime = Math.max(1, ...buyTimeHistogram.map(h => h.count));
  const totalScheduled = buyTimeHistogram.reduce((s, h) => s + h.count, 0);
  const activeHours = buyTimeHistogram.filter(h => h.count > 0).length;
  const resolveSymbol = (addr) => symbolMap[(addr || '').toLowerCase()] || shortAddress(addr);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {}
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                InkDCA Analytics
              </h1>
              <p className="text-purple-100 text-sm">
                Last updated: {new Date(metadata.dataFetchedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              {metadata?.needsSync && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
                >
                  <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {syncing ? syncMessage : `Sync`}
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing || syncing}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 backdrop-blur"
              >
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-all backdrop-blur"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {}
        {metadata?.ownerBalance && (() => {
          const balance = parseFloat(metadata.ownerBalance);
          let bgColor, borderColor, textColor, icon, message;

          if (balance < 0.00001) {
            bgColor = "bg-red-50";
            borderColor = "border-red-500";
            textColor = "text-red-900";
            icon = (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            );
            message = "CRITICAL: Owner balance is critically low! Gas fees may fail.";
          } else if (balance < 0.0001) {
            bgColor = "bg-orange-50";
            borderColor = "border-orange-500";
            textColor = "text-orange-900";
            icon = (
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            );
            message = "WARNING: Owner balance is low. Consider topping up soon.";
          } else {
            bgColor = "bg-green-50";
            borderColor = "border-green-500";
            textColor = "text-green-900";
            icon = (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            );
            message = "Owner balance is healthy.";
          }

          return (
            <div className={`${bgColor} border-l-4 ${borderColor} rounded-lg p-4 mb-6 shadow-md`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {icon}
                  <div>
                    <p className={`font-semibold ${textColor}`}>{message}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Owner: <span className="font-mono text-xs">{metadata.ownerAddress?.slice(0, 10)}...{metadata.ownerAddress?.slice(-8)}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${textColor}`}>
                    {balance.toFixed(6)} ETH
                  </p>
                  <p className="text-xs text-gray-500">Contract Owner Balance</p>
                </div>
              </div>
            </div>
          );
        })()}

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-purple-500 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Unique Users</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{overview.uniqueWallets.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Lifetime total</p>
                {overview.activeWallets !== undefined && (
                  <p className="text-xs text-purple-600 mt-1 font-medium">{overview.activeWallets} currently active</p>
                )}
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Total DCA Sessions</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{overview.totalRegistrations.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Strategies created</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-green-500 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Purchases Made</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{overview.totalPurchasesExecuted.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Successful swaps</p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-pink-500 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Active DCA Strategies</p>
                <p className="text-4xl font-bold text-gray-900 mb-1">{overview.totalActiveSessions.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Running sessions (days_left &gt; 0)</p>
                {overview.activeWallets !== undefined && (
                  <p className="text-xs text-pink-600 mt-1 font-medium">Across {overview.activeWallets} wallet{overview.activeWallets !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="bg-pink-100 p-3 rounded-xl">
                <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-2">Unique Trading Pairs</p>
            <p className="text-3xl font-bold">{overview.totalTokenPairs.toLocaleString()}</p>
            <p className="text-xs opacity-75 mt-1">Different token combinations</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-2">Cancellation Rate</p>
            <p className="text-3xl font-bold">{overview.cancellationRate ?? 0}%</p>
            <p className="text-xs opacity-75 mt-1">Of all registered sessions</p>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-2">Cancelled Sessions</p>
            <p className="text-3xl font-bold">{overview.totalCancelledSessions.toLocaleString()}</p>
            <p className="text-xs opacity-75 mt-1">Destroyed DCA strategies</p>
          </div>
        </div>

        {/* Operational health row: cron freshness, ETH runway, USD volume */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className={`rounded-2xl shadow-lg p-6 border-l-4 ${cronHealthy ? 'bg-green-50 border-green-500' : cronWarn ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'}`}>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Cron Health</p>
            <p className={`text-2xl font-bold ${cronHealthy ? 'text-green-900' : cronWarn ? 'text-yellow-900' : 'text-red-900'}`}>
              {timeAgo(overview.lastExecutionTimestamp)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Last successful execution · {overview.avgExecutionsPerDay} buys/day (7d avg)
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-amber-500">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">ETH Runway</p>
            <p className="text-3xl font-bold text-gray-900">
              {overview.ethRunwayDays != null ? `${overview.ethRunwayDays} days` : '-'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              At {metadata.avgGasPerExecEth} ETH/exec
              <span className={`ml-1 text-[10px] px-1 rounded ${metadata.gasPerExecSource === 'measured' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {metadata.gasPerExecSource === 'measured' ? 'measured' : 'fallback'}
              </span>
              <br />· {parseFloat(metadata.ownerBalance).toFixed(6)} ETH owner balance
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-emerald-500">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Total Volume (USD)</p>
            <p className="text-3xl font-bold text-gray-900">{formatUsd(overview.totalUsdVolume)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Lifetime · stables 1:1, ETH @ ${metadata.ethPrice ?? '-'}
            </p>
          </div>
        </div>

        {/* Generated revenue (estimated from registration fees: max(0.1% × total committed, minFee)) */}
        {revenue && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Revenue & Treasury</h3>
                  <p className="text-xs text-gray-500">Fees sent to FeeTreasury vs. live FeeTreasury balance</p>
                </div>
              </div>
              {treasury && revenue.lifetime && (
                <div className="text-right text-xs">
                  <p className="text-gray-500">Treasury vs. lifetime estimate</p>
                  <p className={`font-bold text-sm ${treasury.totalUsd >= revenue.lifetime.totalUsd ? 'text-green-600' : 'text-orange-600'}`}>
                    {revenue.lifetime.totalUsd > 0
                      ? `${((treasury.totalUsd / revenue.lifetime.totalUsd) * 100).toFixed(0)}%`
                      : '-'}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {treasury && (
                <div className="rounded-xl border-2 border-amber-300 overflow-hidden">
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide opacity-90">FeeTreasury Balance</p>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-semibold">LIVE</span>
                    </div>
                    <p className="text-3xl font-bold mt-1">{formatUsd(treasury.totalUsd)}</p>
                    <p className="text-[10px] opacity-80 mt-0.5 font-mono truncate" title={treasury.treasuryAddress}>{shortAddress(treasury.treasuryAddress)}</p>
                  </div>
                  <div className="p-3 bg-amber-50 space-y-1.5 max-h-40 overflow-y-auto">
                    {treasury.balances.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">No balances</p>
                    ) : (
                      treasury.balances.map((t, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-700">{t.symbol}</span>
                          <div className="text-right">
                            <span className="text-gray-900 font-mono">{t.amount}</span>
                            {t.usd > 0 && <span className="ml-2 text-gray-500">({formatUsd(t.usd)})</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {[
                { key: 'lifetime', label: 'Lifetime (est.)', tone: 'from-emerald-500 to-emerald-600' },
                { key: 'monthly',  label: 'Last 30 days',    tone: 'from-teal-500 to-teal-600' },
                { key: 'weekly',   label: 'Last 7 days',     tone: 'from-cyan-500 to-cyan-600' },
              ].map(({ key, label, tone }) => {
                const bucket = revenue[key];
                if (!bucket) return null;
                return (
                  <div key={key} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className={`bg-gradient-to-br ${tone} text-white p-4`}>
                      <p className="text-xs uppercase tracking-wide opacity-90">{label}</p>
                      <p className="text-3xl font-bold mt-1">{formatUsd(bucket.totalUsd)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 space-y-1.5 max-h-40 overflow-y-auto">
                      {bucket.byToken.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">No revenue in this period</p>
                      ) : (
                        bucket.byToken.map((t, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-700">{t.symbol}</span>
                            <div className="text-right">
                              <span className="text-gray-900 font-mono">{t.amount}</span>
                              {t.usd > 0 && <span className="ml-2 text-gray-500">({formatUsd(t.usd)})</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Revenue = sum of <code className="font-mono text-xs">tokenMinFees[sourceToken]</code> sent to FeeTreasury per non-exempted registration (fees not refunded on cancel).
              Treasury card reflects the FeeTreasury contract's live balances; gap vs. lifetime shows how much has already been withdrawn via <code className="font-mono text-xs">withdrawFees</code> / <code className="font-mono text-xs">withdrawTokens</code>.
            </p>
          </div>
        )}

        {/* Active sessions broken down by destination token */}
        {activeSessionsByToken.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-pink-100 p-2 rounded-lg">
                <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Active Sessions by Token</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {activeSessionsByToken.map((s, i) => (
                <div key={i} className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-3 border border-pink-200 text-center">
                  <p className="text-xs font-semibold text-pink-700 uppercase tracking-wide">{s.symbol}</p>
                  <p className="text-2xl font-bold text-pink-900">{s.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {attemptStats && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">DCA Execution Reliability (Last 30 Days)</h2>
              </div>

              {}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
                  <p className="text-sm text-indigo-600 font-medium mb-1">Total Attempts</p>
                  <p className="text-3xl font-bold text-indigo-900">{attemptStats.overview.totalAttempts.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <p className="text-sm text-green-600 font-medium mb-1">Successful</p>
                  <p className="text-3xl font-bold text-green-900">{attemptStats.overview.successfulAttempts.toLocaleString()}</p>
                  <p className="text-xs text-green-700 mt-1">{attemptStats.overview.successRate}% success rate</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                  <p className="text-sm text-red-600 font-medium mb-1">Failed</p>
                  <p className="text-3xl font-bold text-red-900">{attemptStats.overview.failedAttempts.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-600 font-medium mb-1">Retried</p>
                  <p className="text-3xl font-bold text-yellow-900">{attemptStats.overview.retriedAttempts.toLocaleString()}</p>
                  <p className="text-xs text-yellow-700 mt-1">{attemptStats.overview.retriedSuccess} succeeded</p>
                </div>
              </div>

              {}
              {attemptStats.dailyTimeline && attemptStats.dailyTimeline.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Daily Success Rate</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {attemptStats.dailyTimeline.slice(-14).reverse().map((day, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <p className="text-xs font-medium text-gray-600 w-24">{day.date}</p>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
                              style={{ width: `${day.successRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-green-600 w-12">{day.successRate}%</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-green-600 font-medium">✓ {day.successful}</span>
                          <span className="text-red-600 font-medium">✗ {day.failed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {}
              {attemptStats.topErrors && attemptStats.topErrors.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Top Errors</h3>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {attemptStats.topErrors.slice(0, 5).map((errorItem, index) => {
                      const isExpanded = expandedError === index;
                      return (
                        <div key={index} className="bg-red-50 rounded-lg border border-red-100 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedError(isExpanded ? null : index)}
                            className="w-full text-left p-3 hover:bg-red-100 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-1 gap-2">
                              <p className="text-xs font-mono text-red-900 flex-1 line-clamp-2">{errorItem.message}</p>
                              <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap">{errorItem.count}×</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="text-red-700">Affects {errorItem.affectedBuyers} buyer{errorItem.affectedBuyers !== 1 ? 's' : ''}</span>
                                {errorItem.recoveredPairs > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">{errorItem.recoveredPairs} recovered</span>
                                )}
                                {errorItem.unresolvedPairs > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-200 text-red-800 font-semibold">{errorItem.unresolvedPairs} still failing</span>
                                )}
                              </div>
                              <span className="text-xs text-red-500">{isExpanded ? '▼' : '▶'}</span>
                            </div>
                          </button>
                          {isExpanded && errorItem.affectedBuyersList && (
                            <div className="border-t border-red-200 bg-white p-3 space-y-1.5">
                              {errorItem.affectedBuyersList.map((b, bi) => (
                                <div key={bi} className="flex items-center justify-between text-xs gap-2 py-1 border-b border-gray-100 last:border-b-0">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${b.recovered ? 'bg-green-500' : 'bg-red-500'}`} title={b.recovered ? 'Recovered' : 'Still failing'} />
                                    <span className="font-mono text-gray-800 truncate" title={b.buyer}>{shortAddress(b.buyer)}</span>
                                    <span className="text-gray-400">·</span>
                                    <span className="text-gray-600 truncate">{resolveSymbol(b.sourceToken)} → {resolveSymbol(b.destinationToken)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${b.recovered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {b.recovered ? 'Recovered' : 'Failing'}
                                    </span>
                                    {b.lastTxHash && b.recovered && (
                                      <a
                                        href={`https://explorer.inkonchain.com/tx/${b.lastTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-purple-600 hover:text-purple-800 underline"
                                        title="View recovery tx"
                                      >tx↗</a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per-pair failure rate — surfaces routing problems (e.g. the USDT0→ANITA NO_SWAP_ROUTES_FOUND issue) */}
              {attemptStats.pairFailureRates && attemptStats.pairFailureRates.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Failure Rate by Pair</h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {attemptStats.pairFailureRates.slice(0, 8).map((p, i) => {
                      const sym = (a) => resolveSymbol(a);
                      const tone = p.failureRate >= 20 ? 'red' : p.failureRate >= 5 ? 'yellow' : 'green';
                      const toneClass = tone === 'red' ? 'bg-red-100 text-red-800' : tone === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
                      const barClass = tone === 'red' ? 'from-red-500 to-red-600' : tone === 'yellow' ? 'from-yellow-500 to-yellow-600' : 'from-green-500 to-green-600';
                      return (
                        <div key={i} className="p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-gray-900">{sym(p.sourceToken)} → {sym(p.destinationToken)}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${toneClass}`}>{p.failureRate}% fail</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div className={`bg-gradient-to-r ${barClass} h-2 rounded-full`} style={{ width: `${p.failureRate}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-24 text-right">{p.failed}/{p.totalAttempts} failed</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Source Tokens (Spent)</h2>
            </div>
            <div className="space-y-4">
              {sourceTokenVolumes.slice(0, 10).map((token, index) => {
                const maxVolume = parseFloat(sourceTokenVolumes[0].totalVolume);
                const percentage = (parseFloat(token.totalVolume) / maxVolume) * 100;

                return (
                  <div key={index} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-600 rounded-full text-sm font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900">{token.symbol}</p>
                          <p className="text-xs text-gray-500 font-mono">{token.address.slice(0, 8)}...{token.address.slice(-6)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatTokenAmount(token.totalVolume, token.decimals)}</p>
                        <p className="text-xs text-gray-500">{token.registrationCount} DCAs</p>
                        {token.contractBalance && (
                          <p className="text-xs text-green-600 font-semibold mt-1">
                            Balance: {formatTokenAmount(token.contractBalance, token.decimals)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500 group-hover:from-purple-600 group-hover:to-purple-700"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Destination Tokens (Bought)</h2>
            </div>
            <div className="space-y-4">
              {destinationTokenVolumes.slice(0, 10).map((token, index) => {
                const maxVolume = parseFloat(destinationTokenVolumes[0].totalVolume);
                const percentage = (parseFloat(token.totalVolume) / maxVolume) * 100;

                return (
                  <div key={index} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900">{token.symbol}</p>
                          <p className="text-xs text-gray-500 font-mono">{token.address.slice(0, 8)}...{token.address.slice(-6)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatTokenAmount(token.totalVolume, token.decimals)}</p>
                        <p className="text-xs text-gray-500">{token.purchaseCount} buys</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 group-hover:from-blue-600 group-hover:to-blue-700"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Slippage + price impact distributions from price_impact_cache (last 30d) */}
        {(slippageStats || priceImpactStats) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {slippageStats && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-cyan-100 p-2 rounded-lg">
                    <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Slippage Applied (last 30d)</h3>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">Mean</p><p className="text-2xl font-bold text-cyan-700">{slippageStats.mean}%</p></div>
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">p50</p><p className="text-2xl font-bold text-cyan-700">{slippageStats.p50}%</p></div>
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">p95</p><p className="text-2xl font-bold text-cyan-700">{slippageStats.p95}%</p></div>
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">Max</p><p className="text-2xl font-bold text-cyan-700">{slippageStats.max}%</p></div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">Across {slippageStats.count} executions · range {slippageStats.min}% – {slippageStats.max}%</p>
              </div>
            )}

            {priceImpactStats && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-violet-100 p-2 rounded-lg">
                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Price Impact (last 30d)</h3>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">Mean</p><p className="text-2xl font-bold text-violet-700">{priceImpactStats.mean}%</p></div>
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">p50</p><p className="text-2xl font-bold text-violet-700">{priceImpactStats.p50}%</p></div>
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">p95</p><p className="text-2xl font-bold text-violet-700">{priceImpactStats.p95}%</p></div>
                  <div className="text-center"><p className="text-xs text-gray-500 uppercase">Worst</p><p className="text-2xl font-bold text-violet-700">{priceImpactStats.min}%</p></div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">Negative = unfavorable. Across {priceImpactStats.count} executions.</p>
              </div>
            )}
          </div>
        )}

        {/* Buy-time histogram: when users schedule their DCAs (UTC hour) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 p-2 rounded-lg">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Scheduled Buy Times (UTC)</h3>
                <p className="text-xs text-gray-500">Active sessions grouped by hour-of-day</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-teal-700">{totalScheduled}</p>
              <p className="text-xs text-gray-500">sessions across {activeHours} hour{activeHours !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {totalScheduled === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No active sessions scheduled. The chart populates from on-chain <code className="font-mono text-xs">getDCAConfig().buy_time</code> for sessions with days_left &gt; 0.
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-40 border-b border-gray-200">
                {buyTimeHistogram.map((h) => {
                  const heightPct = (h.count / maxBuyTime) * 100;
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end group relative" title={`${String(h.hour).padStart(2, '0')}:00 — ${h.count} session${h.count !== 1 ? 's' : ''}`}>
                      {h.count > 0 && (
                        <span className="text-[10px] font-bold text-teal-700 mb-0.5">{h.count}</span>
                      )}
                      <div
                        className={`w-full rounded-t transition-all ${h.count > 0 ? 'bg-gradient-to-t from-teal-600 to-teal-400 hover:from-teal-700 hover:to-teal-500' : 'bg-gray-100'}`}
                        style={{ height: h.count > 0 ? `${Math.max(heightPct, 4)}%` : '4%' }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 mt-1.5">
                {buyTimeHistogram.map((h) => (
                  <div key={h.hour} className={`flex-1 text-center text-[10px] font-mono ${h.count > 0 ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
                    {String(h.hour).padStart(2, '0')}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Popular Trading Pairs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokenPairs.slice(0, 9).map((pair, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 hover:border-green-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">{pair.pair}</p>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                    {pair.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {}
        {dailyActivity.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Daily Activity Timeline</h2>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dailyActivity.slice(-30).reverse().map((day, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <p className="text-sm font-medium text-gray-600 w-28">{day.date}</p>
                  <div className="flex-1 flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-600 font-medium">REG</span>
                      <span className="text-sm font-bold text-gray-900">{day.registrations}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium">BUY</span>
                      <span className="text-sm font-bold text-gray-900">{day.purchases}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
