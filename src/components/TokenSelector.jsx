import { useState, useEffect } from "react";
import { TOKENS, getDCATokens, getAvailableSourceTokens } from "../../lib/tokens.config.js";

export default function TokenSelector({ onSelectionChange }) {
  const [selectedDestination, setSelectedDestination] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [availableSources, setAvailableSources] = useState([]);

  const dcaTokens = getDCATokens();

  useEffect(() => {
    if (dcaTokens.length > 0 && !selectedDestination) {
      const firstToken = dcaTokens[0];
      setSelectedDestination(firstToken.key);
      const sources = getAvailableSourceTokens(firstToken.key);
      setAvailableSources(sources);
      if (sources.length > 0) {
        setSelectedSource(sources[0].key);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedDestination) {
      const sources = getAvailableSourceTokens(selectedDestination);
      setAvailableSources(sources);

      if (sources.length > 0) {

        const isCurrentSourceAvailable = sources.some(s => s.key === selectedSource);
        if (!isCurrentSourceAvailable) {
          setSelectedSource(sources[0].key);
        }
      } else {
        setSelectedSource("");
      }
    }
  }, [selectedDestination]);

  useEffect(() => {
    if (selectedDestination && selectedSource) {
      onSelectionChange({
        destination: TOKENS[selectedDestination],
        destinationKey: selectedDestination,
        source: TOKENS[selectedSource],
        sourceKey: selectedSource,
      });
    }
  }, [selectedDestination, selectedSource, onSelectionChange]);

  return (
    <div className="mb-6 border border-purple-300 rounded-lg p-4 bg-purple-50">
      <h3 className="text-lg font-semibold text-purple-800 mb-3">Select Token Pair</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Source Token (What you're spending) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Spend (Source)
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-white"
          >
            {availableSources.map((source) => (
              <option key={source.key} value={source.key}>
                {source.symbol} - {source.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination Token (What you're buying) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buy (Destination)
          </label>
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-white"
          >
            {dcaTokens.map((token) => (
              <option key={token.key} value={token.key}>
                {token.symbol} - {token.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedSource && selectedDestination && (
        <div className="mt-3 text-sm text-gray-600 text-center">
          DCA from <span className="font-semibold text-purple-700">{TOKENS[selectedSource].symbol}</span>
          {" → "}
          <span className="font-semibold text-purple-700">{TOKENS[selectedDestination].symbol}</span>
        </div>
      )}
    </div>
  );
}
