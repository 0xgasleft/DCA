import { useState, useEffect } from "react";
import { FaSpinner } from "react-icons/fa";
import { ethers } from "ethers";
import { TOKENS } from "../../lib/tokens.config.js";
import { formatNumber } from "../../lib/utils.js";

export default function TokenStatsCard({ tokenSymbol, sourceSymbol, compact = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [tokenSymbol, sourceSymbol]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      let sourceToken = TOKENS[sourceSymbol]?.address;
      const destinationToken = TOKENS[tokenSymbol]?.address;

      if (!sourceToken || !destinationToken) {
        throw new Error("Invalid token symbols");
      }


      if (TOKENS[sourceSymbol]?.isNative) {
        sourceToken = "0x0000000000000000000000000000000000000000";
      }


      const res = await fetch(`/api/get-dca-stats?source=${sourceToken}&destination=${destinationToken}`);

      if (!res.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`border border-gray-300 dark:border-gray-600 rounded-lg p-${compact ? '2' : '4'} bg-gray-50 dark:bg-gray-700 flex items-center justify-center ${compact ? 'min-h-[80px]' : 'min-h-[200px]'}`}>
        <FaSpinner className={`animate-spin text-purple-600 dark:text-purple-400 ${compact ? 'text-lg' : 'text-2xl'}`} />
        <span className={`ml-2 text-gray-600 dark:text-gray-300 ${compact ? 'text-sm' : ''}`}>Loading stats...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border border-red-300 dark:border-red-800 rounded-lg p-${compact ? '2' : '4'} bg-red-50 dark:bg-red-900/20`}>
        <p className={`text-red-600 dark:text-red-400 ${compact ? 'text-sm' : ''}`}>Error: {error}</p>
        {!compact && (
          <button
            onClick={fetchStats}
            className="mt-2 text-sm text-red-700 dark:text-red-400 underline hover:text-red-900 dark:hover:text-red-300"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`border border-gray-300 dark:border-gray-600 rounded-lg p-${compact ? '2' : '4'} bg-gray-50 dark:bg-gray-700`}>
        <p className={`text-gray-600 dark:text-gray-300 ${compact ? 'text-sm' : ''}`}>No stats available</p>
      </div>
    );
  }


  const sourceDecimals = TOKENS[sourceSymbol]?.decimals || 18;


  const formatVolume = (weiValue) => {
    if (!weiValue || weiValue === '0' || weiValue === 0) return '0';


    const weiString = typeof weiValue === 'number' ? weiValue.toString() : weiValue;

    try {
      const formatted = ethers.formatUnits(weiString, sourceDecimals);
      const num = parseFloat(formatted);


      if (num >= 1000000) {
        return formatNumber(num / 1000000) + 'M';
      } else if (num >= 1000) {
        return formatNumber(num / 1000) + 'K';
      }
      return formatNumber(num);
    } catch (err) {
      console.error('Error formatting volume:', err, 'Value:', weiValue);
      return '0';
    }
  };


  if (compact) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Registered</p>
            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
              {formatVolume(stats.volume_registered)} <span className="text-xs font-normal">{sourceSymbol}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Executed</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">
              {formatVolume(stats.volume_executed)} <span className="text-xs font-normal">{sourceSymbol}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Purchases</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {stats.purchase_count.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="border border-purple-300 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300">
          {sourceSymbol} → {tokenSymbol} DCA Stats
        </h3>
        <button
          onClick={fetchStats}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 underline"
          title="Refresh stats"
        >
          Refresh
        </button>
      </div>

      {}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border-l-4 border-purple-500 dark:border-purple-400">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Volume Registered</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {formatVolume(stats.volume_registered)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sourceSymbol}</p>
        </div>

        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border-l-4 border-green-500 dark:border-green-400">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Volume Executed</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {formatVolume(stats.volume_executed)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sourceSymbol}</p>
        </div>

        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500 dark:border-blue-400 col-span-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Purchases</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.purchase_count.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">DCA swaps executed</p>
        </div>
      </div>

      {}
      <div className="mt-4 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-md">
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <p className="text-sm text-purple-100 font-medium mb-1">Powered by</p>
            <p className="text-3xl font-bold text-white tracking-wide">Relay</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>

      {}
      {stats.cached && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
          ⚡ Cached {stats.cacheAge}s ago • Updates in real-time
        </div>
      )}

      {stats.updated_at && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
          Last updated: {new Date(stats.updated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}
