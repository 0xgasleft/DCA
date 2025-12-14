import { useState } from "react";
import TokenStatsCard from "./TokenStatsCard";
import { TOKENS } from "../../lib/tokens.config";


export default function TokenCard({ token, tokenKey, onSelectDCA }) {
  const [expanded, setExpanded] = useState(false);

  if (!token.dcaConfig || token.dcaConfig.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-gray-800">
      {}
      <div
        className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 dark:from-purple-700 dark:via-purple-800 dark:to-purple-900 p-6 cursor-pointer hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 dark:hover:from-purple-600 dark:hover:via-purple-700 dark:hover:to-purple-800 transition-all duration-300"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {token.logo && (
              <div className="w-16 h-16 rounded-full bg-white p-2 shadow-md flex items-center justify-center">
                <img
                  src={token.logo}
                  alt={token.symbol}
                  className="w-12 h-12 object-contain"
                />
              </div>
            )}
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">{token.symbol}</h3>
              <p className="text-purple-100 text-sm">{token.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-purple-100 text-xs">Available Options</p>
              <p className="text-white font-bold text-lg">{token.dcaConfig.length}</p>
            </div>
            <svg
              className={`w-6 h-6 text-white transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {}
      {expanded && (
        <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Choose a source currency to start your DCA strategy:
          </p>
          {token.dcaConfig.map((dcaConfig, index) => (
            <DCAOptionCard
              key={index}
              tokenKey={tokenKey}
              token={token}
              dcaConfig={dcaConfig}
              onSelect={onSelectDCA}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function DCAOptionCard({ tokenKey, token, dcaConfig, onSelect }) {

  const sourceToken = TOKENS[dcaConfig.source];
  const sourceSymbol = sourceToken ? sourceToken.symbol : dcaConfig.source;

  return (
    <div className="bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-5 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md transition-all duration-200">
      {}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-800 dark:text-white">{sourceSymbol}</span>
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{token.symbol}</span>
          </div>
        </div>
        <button
          onClick={() => onSelect({
            destinationKey: tokenKey,
            sourceKey: dcaConfig.source,
            destination: token,
            source: dcaConfig.source
          })}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 dark:hover:from-purple-600 dark:hover:to-purple-700 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-semibold text-sm"
        >
          Configure DCA
        </button>
      </div>

      {}
      <TokenStatsCard
        tokenSymbol={tokenKey}
        sourceSymbol={dcaConfig.source}
        compact={true}
      />
    </div>
  );
}
