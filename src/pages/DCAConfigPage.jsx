import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { FaSpinner } from "react-icons/fa";
import TokenStatsCard from "../components/TokenStatsCard";
import ClockTimePicker from "../components/ClockTimePicker.jsx";
import { formatNumber } from "../../lib/utils.js";
import { fetchPriceImpact, formatPriceImpact, getPriceImpactSeverity } from "../../lib/priceImpact.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

export default function DCAConfigPage({
  selectedPair,
  onBack,
  onSubmit,
  tokenBalance,
  needsApproval,
  onApprove,
  approving,
  approvalGranted,
  loading,
  status,
  minFee,
  isExemptedFromFees,
}) {
  const [amountPerDay, setAmountPerDay] = useState("");
  const [daysLeft, setDaysLeft] = useState("");
  const [buyTime, setBuyTime] = useState("00:00");
  const [priceImpactData, setPriceImpactData] = useState(null);
  const [fetchingImpact, setFetchingImpact] = useState(false);

  const totalAmount = parseFloat(amountPerDay || 0) * parseInt(daysLeft || 0);
  const fee = totalAmount * 0.001;
  const finalFee = Math.max(fee, minFee || 0.00005);
  const calculatedFee = `${formatNumber(finalFee)} ${selectedPair.source.symbol}`;

  // Fetch price impact when amount changes
  useEffect(() => {
    const fetchImpact = async () => {
      if (!amountPerDay || parseFloat(amountPerDay) <= 0) {
        setPriceImpactData(null);
        return;
      }

      setFetchingImpact(true);
      try {
        const sourceTokenAddress = selectedPair.source.isNative
          ? "0x0000000000000000000000000000000000000000"
          : selectedPair.source.address;
        const destTokenAddress = selectedPair.destination.address;
        const amountInWei = ethers.parseUnits(amountPerDay, selectedPair.source.decimals);

        const impact = await fetchPriceImpact(
          CONTRACT_ADDRESS,
          sourceTokenAddress,
          destTokenAddress,
          amountInWei
        );

        setPriceImpactData(impact);
      } catch (error) {
        console.error("Error fetching price impact:", error);
        setPriceImpactData(null);
      } finally {
        setFetchingImpact(false);
      }
    };

    // Debounce the fetch (increased to reduce RPC calls)
    const timeoutId = setTimeout(fetchImpact, 1500);
    return () => clearTimeout(timeoutId);
  }, [amountPerDay, selectedPair]);

  const handleSubmit = () => {
    onSubmit({ amountPerDay, daysLeft, buyTime });
  };

  const handleApprove = () => {
    onApprove({ amountPerDay, daysLeft });
  };

  return (
    <>
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-md mx-4 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center">
              {/* Animated Spinner */}
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-4 border-transparent border-t-pink-500 dark:border-t-pink-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
              </div>

              {/* Loading Text */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Registering DCA</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-4">
                Please confirm the transaction in your wallet
              </p>

              {/* Processing Steps */}
              <div className="w-full mt-4">
                <div className="flex items-center justify-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse"></div>
                  <span>Processing transaction...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to selection
        </button>

      {/* Header */}
      <div className={`rounded-t-2xl p-6 text-white ${isExemptedFromFees ? 'bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800' : 'bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Configure Your DCA</h2>
            <p className={isExemptedFromFees ? 'text-green-100' : 'text-purple-100'}>
              {selectedPair.sourceKey} → {selectedPair.destinationKey}
            </p>
          </div>
          {isExemptedFromFees && (
            <div className="text-right">
              <div className="text-sm font-semibold bg-white bg-opacity-20 px-3 py-1 rounded-full">
                ⭐ Fee Exempt
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white dark:bg-gray-800 border-x border-purple-200 dark:border-gray-700 p-6">
        <TokenStatsCard
          tokenSymbol={selectedPair.destinationKey}
          sourceSymbol={selectedPair.sourceKey}
        />
      </div>

      {/* Configuration Form */}
      <div className="bg-white dark:bg-gray-800 rounded-b-2xl border border-t-0 border-purple-200 dark:border-gray-700 p-6 shadow-lg">
        {/* Amount Per Day */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Daily Spending Amount ({selectedPair.source.symbol})
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            You will spend this amount of {selectedPair.source.symbol} daily to buy {selectedPair.destination.symbol}
          </p>
          <input
            type="number"
            min="0.00005"
            step="0.0001"
            value={amountPerDay}
            onChange={(e) => setAmountPerDay(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
            placeholder="0.01"
          />
          {tokenBalance && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Balance: {formatNumber(parseFloat(tokenBalance))} {selectedPair.source.symbol}
            </p>
          )}

          {/* Price Impact Display - Right under amount input */}
          {amountPerDay && parseFloat(amountPerDay) > 0 && (
            <div className="mt-3 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Expected Price Impact</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Per daily purchase (may change at execution)</p>
                  </div>
                </div>
                {fetchingImpact && (
                  <FaSpinner className="animate-spin text-blue-600 dark:text-blue-400 w-3 h-3" />
                )}
              </div>

              {fetchingImpact ? (
                <div className="text-center py-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Calculating...</p>
                </div>
              ) : priceImpactData?.error ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                    {priceImpactData.error === 'AMOUNT_NOT_SUPPORTED'
                      ? '⚠️ Amount Not Supported'
                      : '⚠️ Unable to Get Quote'}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {priceImpactData.error === 'AMOUNT_NOT_SUPPORTED'
                      ? 'This swap amount is not supported by the liquidity router. Try a smaller or larger amount.'
                      : 'Unable to fetch price quote from Relay. Please try again.'}
                  </p>
                </div>
              ) : priceImpactData ? (
                <div className="space-y-3">
                  {/* Warning Banner */}
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Current Market Values</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          These values reflect current market conditions and may differ at execution time due to price movements and liquidity changes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expected Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Expected Price Impact */}
                    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-700 dark:to-blue-900/30 rounded-lg p-2.5 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Price Impact</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-base font-bold ${
                          priceImpactData.priceImpact > 0 ? 'text-blue-600' :
                          priceImpactData.priceImpact < 0 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {formatPriceImpact(priceImpactData.priceImpact)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                          priceImpactData.priceImpact > 0 ? 'bg-blue-100 text-blue-700' :
                          priceImpactData.priceImpact < 0 ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {priceImpactData.priceImpact > 0 ? 'Gain' : priceImpactData.priceImpact < 0 ? 'Loss' : 'Neutral'}
                        </span>
                      </div>
                    </div>

                    {/* Expected Slippage */}
                    <div className="bg-gradient-to-br from-white to-purple-50 dark:from-gray-700 dark:to-purple-900/30 rounded-lg p-2.5 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Slippage</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-gray-700 dark:text-gray-200">
                          {priceImpactData.slippagePercent ? `${priceImpactData.slippagePercent}%` :
                           Math.abs(priceImpactData.priceImpact) < 0.01 ? '<0.01%' : `${Math.abs(priceImpactData.priceImpact).toFixed(2)}%`}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                          Math.abs(priceImpactData.priceImpact) < 1 ? 'bg-green-100 text-green-700' :
                          Math.abs(priceImpactData.priceImpact) < 3 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.abs(priceImpactData.priceImpact) < 1 ? 'Low' :
                           Math.abs(priceImpactData.priceImpact) < 3 ? 'Medium' : 'High'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expected Output */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-2.5 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Expected Output:</span>
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">
                        ~{ethers.formatUnits(priceImpactData.expectedOutput, selectedPair.destination.decimals)} {selectedPair.destination.symbol}
                      </span>
                    </div>
                    {priceImpactData.minOutputAmount && (
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-green-200 dark:border-green-800">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Minimum (worst case):</span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {ethers.formatUnits(priceImpactData.minOutputAmount, selectedPair.destination.decimals)} {selectedPair.destination.symbol}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Warning for extreme negative impact */}
                  {getPriceImpactSeverity(priceImpactData.priceImpact) === 'extreme' && priceImpactData.priceImpact < 0 && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-xs text-red-700 dark:text-red-400">
                        ⚠️ Very high negative impact! Consider adjusting the daily amount.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Total DCA Days */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Total DCA Days
          </label>
          <input
            type="number"
            min="1"
            max="365"
            value={daysLeft}
            onChange={(e) => setDaysLeft(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
            placeholder="30"
          />
        </div>

        {/* Allocation Summary */}
        <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-4 font-medium">
            Total DCA Plan: Spend <span className="text-purple-600 dark:text-purple-400 font-bold">{isNaN(totalAmount) ? "-" : formatNumber(totalAmount)} {selectedPair.source.symbol}</span> to buy <span className="text-purple-600 dark:text-purple-400 font-bold">{selectedPair.destination.symbol}</span>
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">Total to Spend</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {isNaN(totalAmount) ? "-" : formatNumber(totalAmount)} {selectedPair.source.symbol}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">Estimated Fee (0.1%) or MIN</p>
              {isExemptedFromFees ? (
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-gray-300 dark:text-gray-600 line-through">
                    {amountPerDay && daysLeft ? calculatedFee : "-"}
                  </p>
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded">
                    FREE
                  </span>
                </div>
              ) : (
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {amountPerDay && daysLeft ? calculatedFee : "-"}
                </p>
              )}
            </div>
          </div>

          {/* Fee Exemption Badge */}
          {isExemptedFromFees && (
            <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                ✨ Fee Exempt Account - No Registration Fees!
              </p>
            </div>
          )}
        </div>

        {/* Daily Buy Time */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Daily Buy Time (Your Local Time)
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Select when you want your daily purchase to execute in <span className="font-semibold">your local timezone</span>
          </p>
          <ClockTimePicker value={buyTime} onChange={setBuyTime} />
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">Timezone Info</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Your timezone: <span className="font-semibold">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {needsApproval && (
            <button
              onClick={handleApprove}
              disabled={approving || !amountPerDay || !daysLeft}
              className={`w-full py-4 font-semibold rounded-lg disabled:cursor-not-allowed transition-all duration-500 transform ${
                approvalGranted
                  ? 'bg-green-500 text-white scale-105 shadow-lg'
                  : approving
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50'
                  : 'bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50'
              }`}
            >
              {approvalGranted ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  Approval Granted!
                </span>
              ) : approving ? (
                <span className="flex items-center justify-center gap-2">
                  <FaSpinner className="animate-spin" />
                  Checking approval...
                </span>
              ) : (
                `Approve ${selectedPair.source.symbol}`
              )}
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={needsApproval || loading || !amountPerDay || !daysLeft}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 dark:hover:from-purple-600 dark:hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin" />
                Processing...
              </span>
            ) : (
              "Start DCA"
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
