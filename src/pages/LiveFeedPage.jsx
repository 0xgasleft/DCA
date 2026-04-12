import { useState, useEffect, useRef } from "react";

const PAIR_COLORS = {
  "ETH→kBTC":    { bg: "bg-orange-50 dark:bg-orange-900/20",  dot: "bg-orange-400",  text: "text-orange-700 dark:text-orange-300",  badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700" },
  "ETH→ANITA":   { bg: "bg-purple-50 dark:bg-purple-900/20",  dot: "bg-purple-400",  text: "text-purple-700 dark:text-purple-300",  badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700" },
  "USDT0→kBTC":  { bg: "bg-blue-50 dark:bg-blue-900/20",      dot: "bg-blue-400",    text: "text-blue-700 dark:text-blue-300",      badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700" },
  "USDT0→ANITA": { bg: "bg-pink-50 dark:bg-pink-900/20",      dot: "bg-pink-400",    text: "text-pink-700 dark:text-pink-300",      badge: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700" },
  "USDT0→ETH":   { bg: "bg-green-50 dark:bg-green-900/20",    dot: "bg-green-400",   text: "text-green-700 dark:text-green-300",   badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" },
};

function getPairStyle(src, dst) {
  return PAIR_COLORS[`${src}→${dst}`] || {
    bg: "bg-gray-50 dark:bg-gray-800",
    dot: "bg-gray-400",
    text: "text-gray-600 dark:text-gray-400",
    badge: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600",
  };
}

function formatAmount(val) {
  const num = parseFloat(val);
  if (!isFinite(num) || num === 0) return "0";
  if (num >= 1000) return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (num >= 1) return parseFloat(num.toFixed(4)).toString();
  if (num >= 0.001) return parseFloat(num.toFixed(6)).toString();
  const places = Math.min(Math.ceil(-Math.log10(num)) + 3, 12);
  return num.toFixed(places).replace(/\.?0+$/, "");
}

const FEED_STYLES = `
@keyframes feedSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes feedFlash {
  0%   { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5); }
  50%  { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
  100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}

.feed-item-enter {
  animation: feedSlideIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.feed-item-new {
  animation: feedSlideIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) both,
             feedFlash 0.9s ease-out 0.3s both;
}
`;

export default function LiveFeedPage({ embedded = false }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newIds, setNewIds] = useState(new Set());
  const [filter, setFilter] = useState("all");
  // tracks which txHashes have already been animated so re-renders don't replay
  const animatedRef = useRef(new Set());
  const prevTxHashes = useRef(new Set());

  const fetchFeed = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const res = await fetch("/api/get-recent-executions");
      if (!res.ok) throw new Error("Failed to fetch");
      const { executions: data } = await res.json();

      if (!initial && prevTxHashes.current.size > 0) {
        const incoming = new Set(data.map((e) => e.txHash));
        const fresh = new Set([...incoming].filter((h) => !prevTxHashes.current.has(h)));
        if (fresh.size > 0) {
          setNewIds(fresh);
          setTimeout(() => setNewIds(new Set()), 3000);
        }
      }

      prevTxHashes.current = new Set(data.map((e) => e.txHash));
      setExecutions(data);
      setError(null);
    } catch {
      setError("Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(true);
    const interval = setInterval(() => fetchFeed(false), 30_000);
    return () => clearInterval(interval);
  }, []);

  const availablePairs = [...new Set(executions.map((e) => `${e.sourceSymbol}→${e.destinationSymbol}`))];

  const filtered = filter === "all"
    ? executions
    : executions.filter((e) => `${e.sourceSymbol}→${e.destinationSymbol}` === filter);

  const limit = embedded ? 5 : filtered.length;
  const visible = filtered.slice(0, limit);

  if (loading) {
    return (
      <div className={embedded ? "" : "max-w-3xl mx-auto px-4 py-8"}>
        <style>{FEED_STYLES}</style>
        <div className="space-y-2">
          {Array.from({ length: embedded ? 5 : 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">{error}</div>
    );
  }

  return (
    <div className={embedded ? "" : "max-w-3xl mx-auto px-4 py-8"}>
      <style>{FEED_STYLES}</style>

      {!embedded && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Live Execution Feed</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">DCA purchases · refreshes every 30s</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">LIVE</span>
          </div>
        </div>
      )}

      {/* Pair filter — only in full page view */}
      {!embedded && availablePairs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === "all"
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400"
            }`}
          >
            All pairs
          </button>
          {availablePairs.map((pair) => {
            const [src, dst] = pair.split("→");
            const style = getPairStyle(src, dst);
            return (
              <button
                key={pair}
                onClick={() => setFilter(pair)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filter === pair
                    ? style.badge + " shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-500"
                }`}
              >
                {pair}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        {visible.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">No executions for this pair yet.</p>
        ) : (
          visible.map((ex, i) => {
            const style = getPairStyle(ex.sourceSymbol, ex.destinationSymbol);
            const isNew = newIds.has(ex.txHash);
            // first time we see this hash → animate; subsequent renders → static
            const firstSeen = !animatedRef.current.has(ex.txHash);
            if (firstSeen) animatedRef.current.add(ex.txHash);

            // stagger delay: new live items appear instantly (or fast), initial load staggers
            const delayMs = firstSeen && !isNew ? Math.min(i * 55, 400) : 0;

            return (
              <div
                key={ex.txHash}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors duration-500
                  ${style.bg}
                  ${isNew ? "border-green-400 dark:border-green-600" : "border-transparent"}
                  ${firstSeen ? (isNew ? "feed-item-new" : "feed-item-enter") : ""}
                `}
                style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both" }}
              >
                {/* Colored dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot} ${isNew ? "animate-pulse" : ""}`} />

                {/* Two-line content */}
                <div className="flex-1 min-w-0">
                  {/* Top: wallet + timestamp */}
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                      {ex.buyer}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                      {ex.timeAgo}
                    </span>
                  </div>
                  {/* Bottom: amounts */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-500 dark:text-gray-400">bought</span>
                    <span className={`text-xs font-bold ${style.text}`}>
                      {formatAmount(ex.amountOut)} {ex.destinationSymbol}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">←</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {formatAmount(ex.amountIn)} {ex.sourceSymbol}
                    </span>
                  </div>
                </div>

                {/* Explorer link */}
                <a
                  href={`https://explorer.inkonchain.com/tx/${ex.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  title="View on explorer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            );
          })
        )}
      </div>

      {embedded && executions.length > 5 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
          +{executions.length - 5} more recent executions
        </p>
      )}
    </div>
  );
}
