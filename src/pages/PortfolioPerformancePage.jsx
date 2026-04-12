import { useState, useEffect } from 'react';

// Format raw BigInt string → human-readable, never scientific notation
function fmtAmt(raw, dec = 18) {
  if (!raw || raw === '0') return '0';
  const str = String(raw);
  const neg = str.startsWith('-');
  const absStr = neg ? str.slice(1) : str;
  const val = Number(absStr) / Math.pow(10, dec);
  if (!isFinite(val) || val === 0) return '0';

  let out;
  if (val >= 1_000_000)  out = (val / 1_000_000).toFixed(2) + 'M';
  else if (val >= 1_000) out = val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  else if (val >= 1)     out = val.toFixed(4).replace(/\.?0+$/, '');
  else if (val >= 0.001) out = val.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  else {
    const places = Math.ceil(-Math.log10(val)) + 3;
    out = val.toFixed(Math.min(places, 18)).replace(/0+$/, '').replace(/\.$/, '') || '0';
  }

  return neg ? '-' + out : out;
}

function fmtPct(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const STATUS = {
  active:    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  completed: { label: 'Completed', dot: 'bg-gray-400 dark:bg-gray-500', text: 'text-gray-500 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', dot: 'bg-red-400', text: 'text-red-500' },
};

function SessionCard({ session }) {
  const roi     = parseFloat(session.roiPercentage);
  const hasRoi  = !isNaN(roi) && session.roiAvailable && session.roiPercentage !== null;
  const isPos   = roi >= 0;
  const progress = Math.min(parseFloat(session.completionPercentage || 0), 100);
  const sc      = STATUS[session.status] || STATUS.completed;

  const diff    = session.tokensDifference || '0';
  const diffNeg = diff !== '0' && String(diff).startsWith('-');
  const diffZero = diff === '0';

  return (
    <div className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-gray-900 dark:text-white text-base">
            {session.sourceTokenSymbol} → {session.destinationTokenSymbol}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
            <span className={`text-xs font-medium ${sc.text}`}>{sc.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">· {session.total_days}d strategy</span>
          </div>
        </div>

        <div className="text-right shrink-0 ml-4">
          {hasRoi ? (
            <>
              <div className={`text-2xl font-bold tabular-nums ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {fmtPct(session.roiPercentage)}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">vs lump sum</div>
            </>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 max-w-[110px] text-right leading-relaxed">
              {session.dataQuality === 'insufficient' ? 'Pre-tracking session' : 'ROI unavailable'}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>{Math.min(session.purchasesExecuted, session.expectedPurchases)} / {session.expectedPurchases} days</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              session.status === 'active' ? 'bg-purple-500' : 'bg-gray-400 dark:bg-gray-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Token metrics — only for sessions with valid ROI data */}
      {hasRoi && (
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">DCA received</div>
            <div className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums break-all">
              {fmtAmt(session.totalTokensReceived, session.destinationTokenDecimals)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Lump sum</div>
            <div className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums break-all">
              {fmtAmt(session.lumpSumTokens, session.destinationTokenDecimals)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Difference</div>
            <div className={`text-xs font-semibold tabular-nums break-all ${
              diffZero
                ? 'text-gray-500 dark:text-gray-400'
                : !diffNeg
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
            }`}>
              {!diffNeg && !diffZero ? '+' : ''}{fmtAmt(diff, session.destinationTokenDecimals)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioPerformancePage({ walletAddress }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (walletAddress) load();
  }, [walletAddress]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?address=${walletAddress}&type=roi-metrics`);
      if (!res.ok) throw new Error('Failed to fetch performance data');
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={load}
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2 text-center px-4">
        <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No sessions yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          Performance data appears here after your first DCA session executes.
        </p>
      </div>
    );
  }

  const { summary } = data;

  const sessions = [...data.sessions].sort((a, b) => {
    const rA = parseFloat(a.roiPercentage);
    const rB = parseFloat(b.roiPercentage);
    if (isNaN(rA) && isNaN(rB)) return 0;
    if (isNaN(rA)) return 1;
    if (isNaN(rB)) return -1;
    return rB - rA;
  });

  const colorClass = {
    purple: 'text-purple-600 dark:text-purple-400',
    green:  'text-emerald-600 dark:text-emerald-400',
    red:    'text-red-500',
    none:   'text-gray-900 dark:text-white',
  };

  const stats = [
    {
      label: 'Sessions',
      value: summary.totalSessions,
      color: 'none',
    },
    {
      label: 'Active',
      value: summary.activeSessions,
      color: summary.activeSessions > 0 ? 'purple' : 'none',
    },
    {
      label: 'Avg ROI',
      value: fmtPct(summary.averageROI) ?? '-',
      color: summary.averageROI != null
        ? (parseFloat(summary.averageROI) >= 0 ? 'green' : 'red')
        : 'none',
    },
    {
      label: 'Win Rate',
      value: summary.winRate != null ? `${summary.winRate}%` : '-',
      color: 'none',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
        <button
          onClick={load}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
            <div className={`text-xl font-bold tabular-nums ${colorClass[color]}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <div className="space-y-3">
        {sessions.map((s, i) => (
          <SessionCard
            key={`${s.source_token}-${s.destination_token}-${s.registration_timestamp ?? i}`}
            session={s}
          />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <span className="font-semibold text-gray-700 dark:text-gray-300">How ROI works: </span>
          Total tokens received via daily DCA vs what you'd have received buying everything at once at registration price. Positive means DCA got you a better average entry.
        </p>
      </div>
    </div>
  );
}
