import { useState, useEffect } from "react";

// Smart number formatter that handles very small decimals (like KBTC)
function formatTokenAmount(value, decimals = 18) {
  const num = parseFloat(value);

  if (num === 0) return "0";
  if (isNaN(num)) return "0";

  // For very small numbers (like 0.000000123)
  if (num < 0.0001) {
    // Find first significant digit
    const scientificNotation = num.toExponential();
    const [coefficient, exponent] = scientificNotation.split('e');
    const exp = parseInt(exponent);

    if (exp < -4) {
      // Use scientific notation for very small numbers
      return num.toExponential(4);
    }

    // Show up to 8 significant decimals
    return num.toFixed(8).replace(/\.?0+$/, '');
  }

  // For normal numbers
  if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '');
  if (num < 100) return num.toFixed(4).replace(/\.?0+$/, '');
  if (num < 10000) return num.toFixed(2);

  // For large numbers, use compact notation
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
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

      // Fetch attempt statistics
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

      // Also refresh attempt stats
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

  const { overview, sourceTokenVolumes, destinationTokenVolumes, dailyActivity, tokenPairs, metadata } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
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
        {/* Owner Balance Alert */}
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

        {/* Key Metrics Grid */}
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

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-2">Unique Trading Pairs</p>
            <p className="text-3xl font-bold">{overview.totalTokenPairs.toLocaleString()}</p>
            <p className="text-xs opacity-75 mt-1">Different token combinations</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-2">Completion Rate</p>
            <p className="text-3xl font-bold">{overview.completionRate}%</p>
            <p className="text-xs opacity-75 mt-1">Sessions not cancelled</p>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
            <p className="text-sm opacity-90 mb-2">Avg Purchases/Session</p>
            <p className="text-3xl font-bold">{overview.averagePurchasesPerSession}</p>
            <p className="text-xs opacity-75 mt-1">Execution efficiency</p>
          </div>
        </div>

        {/* Contract Balances Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">DCA Contract Token Balances</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sourceTokenVolumes.map((token, index) => (
              <div key={index} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{token.symbol.charAt(0)}</span>
                    </div>
                    <span className="font-bold text-gray-900">{token.symbol}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-green-700">
                    {formatTokenAmount(token.contractBalance || '0', token.decimals)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">Note:</span> These balances represent tokens currently held in the DCA contract for upcoming purchases.
            </p>
          </div>
        </div>

        {/* DCA Execution Attempts Section */}
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

              {/* Execution Overview Stats */}
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

              {/* Daily Timeline */}
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

            {/* Top Errors and Router Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top Errors */}
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
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {attemptStats.topErrors.slice(0, 5).map((errorItem, index) => (
                      <div key={index} className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-xs font-mono text-red-900 flex-1 line-clamp-2">{errorItem.message}</p>
                          <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{errorItem.count}</span>
                        </div>
                        <p className="text-xs text-red-600">Affected {errorItem.affectedBuyers} buyer{errorItem.affectedBuyers !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Router Usage Stats */}
              {attemptStats.routerStats && Object.keys(attemptStats.routerStats).length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Router Usage</h3>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(attemptStats.routerStats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([router, count], index) => {
                        const total = Object.values(attemptStats.routerStats).reduce((sum, c) => sum + c, 0);
                        const percentage = ((count / total) * 100).toFixed(1);
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-gray-900">{router}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900">{count}</span>
                                <span className="text-xs text-gray-500">({percentage}%)</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Per-Buyer Token Stats */}
            {attemptStats.buyerTokenStats && attemptStats.buyerTokenStats.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Success Rates by Address & Token</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Buyer</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Token</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Attempts</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Success</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Failed</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Rate</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Avg Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attemptStats.buyerTokenStats.slice(0, 20).map((stat, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {stat.buyer.slice(0, 6)}...{stat.buyer.slice(-4)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {stat.destinationToken.slice(0, 6)}...{stat.destinationToken.slice(-4)}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-gray-900">{stat.totalAttempts}</td>
                          <td className="px-4 py-3 text-center text-green-600 font-medium">{stat.successful}</td>
                          <td className="px-4 py-3 text-center text-red-600 font-medium">{stat.failed}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              parseFloat(stat.successRate) >= 95 ? 'bg-green-100 text-green-800' :
                              parseFloat(stat.successRate) >= 80 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {stat.successRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-medium text-gray-700">
                            {stat.avgPriceImpact ? `${stat.avgPriceImpact}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token Volumes Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Source Tokens */}
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

          {/* Destination Tokens */}
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

        {/* Popular Trading Pairs */}
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

        {/* Daily Activity Chart */}
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
