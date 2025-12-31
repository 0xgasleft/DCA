import { useState, useEffect } from 'react';
import { FaTrophy, FaChartLine, FaCoins, FaPercentage, FaArrowUp, FaArrowDown, FaMinus, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaClock, FaBan } from 'react-icons/fa';

const PortfolioPerformancePage = ({ walletAddress }) => {
  const [loading, setLoading] = useState(true);
  const [roiData, setRoiData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (walletAddress) {
      fetchROIMetrics();
    }
  }, [walletAddress]);

  const fetchROIMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/get-user-data?address=${walletAddress}&type=roi-metrics`);

      if (!response.ok) {
        throw new Error('Failed to fetch ROI metrics');
      }

      const data = await response.json();
      setRoiData(data);
    } catch (err) {
      console.error('Error fetching ROI metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTokenAmount = (amount, decimals = 18) => {
    if (!amount) {
      return <span className="text-gray-400 dark:text-gray-600">N/A</span>;
    }
    if (amount === '0') return '0';

    try {
      const value = Number(amount) / Math.pow(10, decimals);

      // If the number is extremely small (less than 0.000001), use scientific notation
      if (value > 0 && value < 0.000001) {
        return value.toExponential(4);
      }

      // For very small numbers (less than 0.01), show more precision
      if (value > 0 && value < 0.01) {
        // Remove trailing zeros for display
        return parseFloat(value.toFixed(8)).toString();
      }

      // For normal numbers, use 6 decimals and remove trailing zeros
      return parseFloat(value.toFixed(6)).toString();
    } catch (err) {
      return <span className="text-yellow-600 dark:text-yellow-400">Error</span>;
    }
  };

  const formatPercentage = (percentage) => {
    if (percentage === null || percentage === undefined) {
      return <span className="text-gray-400 dark:text-gray-600">N/A</span>;
    }
    const num = parseFloat(percentage);
    if (isNaN(num)) {
      return <span className="text-yellow-600 dark:text-yellow-400">Invalid</span>;
    }
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getROIColorClass = (roi) => {
    const num = parseFloat(roi);
    if (num > 0) return 'text-green-600 dark:text-green-400';
    if (num < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getROIIcon = (roi) => {
    const num = parseFloat(roi);
    if (num > 0) return <FaArrowUp className="inline" />;
    if (num < 0) return <FaArrowDown className="inline" />;
    return <FaMinus className="inline" />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <FaCheckCircle /> Completed
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <FaClock /> Active
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            <FaBan /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getTokenSymbol = (tokenAddress) => {
    // This is a simplified version - you can enhance it with actual token lookup
    const tokens = {
      '0x0000000000000000000000000000000000000000': 'ETH',
    };
    return tokens[tokenAddress?.toLowerCase()] || tokenAddress?.slice(0, 6);
  };

  const getDataQualityBadge = (session) => {
    if (!session.roiAvailable) {
      return (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
            <FaExclamationTriangle className="flex-shrink-0" />
            <span><strong>ROI Unavailable:</strong> {session.reason || 'Insufficient data for ROI calculation'}</span>
          </p>
        </div>
      );
    }

    if (session.invalidPurchasesCount > 0) {
      return (
        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-xs text-orange-800 dark:text-orange-200 flex items-center gap-2">
            <FaExclamationTriangle className="flex-shrink-0" />
            <span>
              <strong>Data Quality Notice:</strong> {session.invalidPurchasesCount} purchase(s) excluded from ROI calculation due to missing data.
              Using {session.validPurchasesCount} valid purchase(s).
            </span>
          </p>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FaSpinner className="text-5xl text-blue-500 animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading your portfolio performance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FaExclamationTriangle className="text-5xl text-red-500 mb-4" />
        <p className="text-red-600 dark:text-red-400 mb-2">Error loading ROI metrics</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={fetchROIMetrics}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!roiData || roiData.sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FaChartLine className="text-6xl text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No Performance Data Available Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          ROI tracking is enabled for all new DCA sessions. Complete your first session to see your portfolio performance metrics here.
        </p>
      </div>
    );
  }

  const { summary, sessions } = roiData;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          Portfolio Performance
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your DCA strategy performance vs lump sum investing
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Average ROI */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <FaPercentage className="text-3xl opacity-80" />
            <span className="text-sm font-medium opacity-90">Avg ROI</span>
          </div>
          <div className={`text-3xl font-bold mb-1 ${summary.averageROI && parseFloat(summary.averageROI) >= 0 ? 'text-white' : 'text-red-200'}`}>
            {formatPercentage(summary.averageROI)}
          </div>
          <div className="text-sm opacity-80">
            vs Lump Sum Strategy
          </div>
          {summary.sessionsWithoutROI > 0 && (
            <div className="text-xs opacity-70 mt-2">
              {summary.sessionsWithoutROI} session(s) excluded
            </div>
          )}
        </div>

        {/* Win Rate */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <FaTrophy className="text-3xl opacity-80" />
            <span className="text-sm font-medium opacity-90">Win Rate</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {summary.winRate !== null ? `${summary.winRate}%` : 'N/A'}
          </div>
          <div className="text-sm opacity-80">
            {summary.winningSessionsCount || 0} winning sessions
          </div>
        </div>

        {/* Total Sessions */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <FaChartLine className="text-3xl opacity-80" />
            <span className="text-sm font-medium opacity-90">Sessions</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {summary.completedSessions}
          </div>
          <div className="text-sm opacity-80">
            {summary.activeSessions} active
          </div>
        </div>

        {/* Best Performance */}
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <FaCoins className="text-3xl opacity-80" />
            <span className="text-sm font-medium opacity-90">Best ROI</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {summary.bestROI ? formatPercentage(summary.bestROI) : 'N/A'}
          </div>
          <div className="text-sm opacity-80">
            Worst: {summary.worstROI ? formatPercentage(summary.worstROI) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <h2 className="text-2xl font-bold">DCA Session History</h2>
          <p className="text-sm opacity-90 mt-1">Click on a session to view detailed performance metrics</p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sessions.map((session, index) => {
            const roi = parseFloat(session.roiPercentage);
            const isPositive = roi > 0;
            const isNegative = roi < 0;

            return (
              <div
                key={index}
                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => setSelectedSession(selectedSession === index ? null : index)}
              >
                {/* Session Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                      <span>{getTokenSymbol(session.source_token)}</span>
                      <FaArrowRight className="text-gray-400" />
                      <span>{getTokenSymbol(session.destination_token)}</span>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-bold ${getROIColorClass(roi)}`}>
                      {getROIIcon(roi)} {formatPercentage(session.roiPercentage)}
                    </div>
                  </div>
                </div>

                {/* Session Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Progress</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {session.purchasesExecuted} / {session.expectedPurchases} days
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${session.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tokens Gained</div>
                    <div className={`text-sm font-semibold ${getROIColorClass(roi)}`}>
                      {isPositive ? '+' : ''}{formatTokenAmount(session.tokensDifference, session.destinationTokenDecimals)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">DCA Received</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatTokenAmount(session.totalTokensReceived, session.destinationTokenDecimals)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lump Sum Would Get</div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatTokenAmount(session.lumpSumTokens, session.destinationTokenDecimals)}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedSession === index && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Detailed Metrics
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Investment Details */}
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Investment Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Total Invested:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatTokenAmount(session.totalInvested, session.sourceTokenDecimals)} {session.sourceTokenSymbol}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Per Day:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatTokenAmount(session.amount_per_day, session.sourceTokenDecimals)} {session.sourceTokenSymbol}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {session.total_days} days
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Price Volatility */}
                      {session.volatility && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Price Volatility
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Best Rate:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {session.volatility.max.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Worst Rate:</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                {session.volatility.min.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Range:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {session.volatility.range}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Timeline
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Registered:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {new Date(session.registration_timestamp * 1000).toLocaleString()}
                            </span>
                          </div>
                          {session.firstPurchaseTimestamp && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">First Buy:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {new Date(session.firstPurchaseTimestamp * 1000).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {session.lastPurchaseTimestamp && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Last Buy:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {new Date(session.lastPurchaseTimestamp * 1000).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Data Quality Badge */}
                    {getDataQualityBadge(session)}

                    {/* ROI Explanation */}
                    {session.roiAvailable && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-900 dark:text-blue-200">
                          <strong>ROI Calculation:</strong> This shows how much {isPositive ? 'more' : 'less'} tokens you received
                          through DCA compared to if you had bought everything at the registration price.
                          {isPositive && ' DCA helped you get a better average price!'}
                          {isNegative && ' In this case, a lump sum would have been better.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Banner */}
      <div className="mt-8 p-6 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-2 flex items-center gap-2">
          <FaChartLine /> How ROI is Calculated
        </h3>
        <p className="text-purple-800 dark:text-purple-300 text-sm leading-relaxed">
          We compare the total tokens you received through daily DCA purchases against what you would have received
          if you bought everything at once when you first registered the session. Positive ROI means DCA helped you
          get a better average price, while negative ROI means a lump sum purchase would have been better.
          This metric helps you understand the effectiveness of your DCA strategy over time.
        </p>
      </div>
    </div>
  );
};

// Missing import for the arrow icon
import { FaArrowRight } from 'react-icons/fa';

export default PortfolioPerformancePage;
