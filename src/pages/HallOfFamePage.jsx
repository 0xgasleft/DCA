import { useState, useEffect } from "react";


function formatTokenAmount(value, decimals = 18) {
  const num = parseFloat(value);
  if (num === 0) return "0";
  if (isNaN(num)) return "0";
  if (num < 0.0001) return num.toExponential(4);
  if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '');
  if (num < 100) return num.toFixed(4).replace(/\.?0+$/, '');
  if (num < 10000) return num.toFixed(2);
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function HallOfFamePage() {
  
  useEffect(() => {
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  }, []);
  const [hallOfFame, setHallOfFame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHallOfFame();
  }, []);

  const fetchHallOfFame = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/get-hall-of-fame", {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Hall of Fame data");
      }

      const result = await response.json();
      if (result.success) {
        setHallOfFame(result);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error('Failed to fetch Hall of Fame:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400 text-lg" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Loading Hall of Fame...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl shadow-lg p-12 text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-xl font-bold text-red-900 dark:text-red-200 mb-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '800' }}>Failed to Load</h3>
          <p className="text-red-700 dark:text-red-300 mb-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>{error}</p>
          <button
            onClick={fetchHallOfFame}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!hallOfFame || !hallOfFame.rankings || hallOfFame.rankings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
          <span className="text-6xl mb-4 block">🏆</span>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '800' }}>No Rankings Yet</h3>
          <p className="text-gray-600 dark:text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Be the first to register a DCA strategy and claim the top spot!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {}
      <div className="relative overflow-hidden rounded-3xl mb-12">
        {}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/30 via-purple-600/30 to-pink-600/30 animate-pulse-slow"></div>

        {}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-pink-400/20 to-transparent rounded-full blur-3xl"></div>

        {}
        <div className="relative z-10 px-8 py-12 md:py-16">
          <div className="text-center">
            {}
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
              <svg className="w-12 h-12 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
              </svg>
            </div>

            {}
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', letterSpacing: '-0.02em' }}>
              HALL OF FAME
            </h1>

            {}
            <p className="text-xl md:text-2xl text-white/90 mb-6 font-medium" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
              Honoring the Keepers of the DCA Flame
            </p>

            {}
            <div className="inline-flex items-center gap-8 bg-white/10 backdrop-blur-xl rounded-2xl px-8 py-4 border border-white/20 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                <div className="w-2 h-2 bg-green-400 rounded-full absolute"></div>
                <span className="text-white/80 text-sm font-medium" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Live Rankings</span>
              </div>
              <div className="h-6 w-px bg-white/20"></div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                  {hallOfFame.metadata.totalUsers}
                </span>
                <span className="text-xs text-white/70 uppercase tracking-wider font-semibold" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                  Ranked
                </span>
              </div>
            </div>
          </div>
        </div>

        {}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
      </div>

      {}
      {hallOfFame.rankings.length >= 3 && (
        <div className="mb-12 max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 items-end">
            {}
            <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="relative group">
                {}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-slate-400 via-slate-300 to-slate-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500"></div>

                {}
                <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl transform group-hover:-translate-y-2 transition-all duration-500">
                  {}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="relative">
                      <div className="w-16 h-16 bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 rounded-2xl rotate-45 shadow-lg"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-black text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>2</span>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="mt-8 text-center space-y-3">
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 tracking-wider truncate px-2" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {hallOfFame.rankings[1].address.slice(0, 8)}...{hallOfFame.rankings[1].address.slice(-6)}
                    </div>

                    <div className="space-y-1">
                      <div className="text-3xl font-black text-slate-700 dark:text-slate-200" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                        {hallOfFame.rankings[1].score}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">Score</div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                        ${hallOfFame.rankings[1].totalUsdVolume.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Volume</div>
                    </div>

                    <div className="flex justify-around pt-2 text-center">
                      <div>
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{hallOfFame.rankings[1].completionRate}%</div>
                        <div className="text-xs text-slate-500">Complete</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{hallOfFame.rankings[1].stats.totalRegistrations}</div>
                        <div className="text-xs text-slate-500">Strategies</div>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="absolute top-4 right-4 w-8 h-8 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full opacity-20"></div>
                </div>
              </div>
            </div>

            {}
            <div className="animate-slide-up -mt-8" style={{ animationDelay: '0s' }}>
              <div className="relative group">
                {}
                <div className="absolute -inset-1 bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse-slow"></div>

                {}
                <div className="relative bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/50 dark:to-amber-900/50 backdrop-blur-xl rounded-3xl p-8 border-2 border-yellow-300 dark:border-yellow-600 shadow-2xl transform group-hover:-translate-y-3 transition-all duration-500">
                  {}
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl rotate-45 shadow-2xl"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="mt-10 text-center space-y-4">
                    <div className="text-sm font-mono font-bold text-yellow-800 dark:text-yellow-300 tracking-wider truncate px-2" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {hallOfFame.rankings[0].address.slice(0, 8)}...{hallOfFame.rankings[0].address.slice(-6)}
                    </div>

                    <div className="space-y-1">
                      <div className="text-5xl font-black text-yellow-900 dark:text-yellow-200" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                        {hallOfFame.rankings[0].score}
                      </div>
                      <div className="text-sm uppercase tracking-widest text-yellow-700 dark:text-yellow-400 font-bold">Champion Score</div>
                    </div>

                    <div className="pt-4 border-t-2 border-yellow-300 dark:border-yellow-600">
                      <div className="text-2xl font-black text-yellow-900 dark:text-yellow-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                        ${hallOfFame.rankings[0].totalUsdVolume.toLocaleString()}
                      </div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold">Total Volume</div>
                    </div>

                    <div className="flex justify-around pt-3 text-center">
                      <div>
                        <div className="text-lg font-black text-yellow-800 dark:text-yellow-200">{hallOfFame.rankings[0].completionRate}%</div>
                        <div className="text-xs text-yellow-700 dark:text-yellow-400">Complete</div>
                      </div>
                      <div>
                        <div className="text-lg font-black text-yellow-800 dark:text-yellow-200">{hallOfFame.rankings[0].stats.totalRegistrations}</div>
                        <div className="text-xs text-yellow-700 dark:text-yellow-400">Strategies</div>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="absolute top-6 right-6 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                  <div className="absolute bottom-6 left-6 w-2 h-2 bg-amber-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            </div>

            {}
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative group">
                {}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-400 via-orange-300 to-amber-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500"></div>

                {}
                <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 border border-orange-200 dark:border-orange-700 shadow-2xl transform group-hover:-translate-y-2 transition-all duration-500">
                  {}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="relative">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 rounded-2xl rotate-45 shadow-lg"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-black text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>3</span>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="mt-8 text-center space-y-3">
                    <div className="text-xs font-mono text-orange-600 dark:text-orange-400 tracking-wider truncate px-2" style={{ fontFamily: 'SF Mono, Monaco, monospace' }}>
                      {hallOfFame.rankings[2].address.slice(0, 8)}...{hallOfFame.rankings[2].address.slice(-6)}
                    </div>

                    <div className="space-y-1">
                      <div className="text-3xl font-black text-orange-700 dark:text-orange-200" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                        {hallOfFame.rankings[2].score}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-orange-500 dark:text-orange-400 font-semibold">Score</div>
                    </div>

                    <div className="pt-3 border-t border-orange-200 dark:border-orange-700">
                      <div className="text-lg font-bold text-orange-900 dark:text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                        ${hallOfFame.rankings[2].totalUsdVolume.toLocaleString()}
                      </div>
                      <div className="text-xs text-orange-500 dark:text-orange-400">Volume</div>
                    </div>

                    <div className="flex justify-around pt-2 text-center">
                      <div>
                        <div className="text-sm font-bold text-orange-700 dark:text-orange-300">{hallOfFame.rankings[2].completionRate}%</div>
                        <div className="text-xs text-orange-500">Complete</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-orange-700 dark:text-orange-300">{hallOfFame.rankings[2].stats.totalRegistrations}</div>
                        <div className="text-xs text-orange-500">Strategies</div>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="absolute top-4 right-4 w-8 h-8 bg-gradient-to-br from-orange-300 to-amber-400 rounded-full opacity-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-up {
          animation: slide-up 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>

      {}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
            <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <tr>
                <th className="px-6 py-5 text-left text-sm font-semibold uppercase tracking-wide sticky left-0 bg-gradient-to-r from-purple-600 to-purple-600 z-10" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Rank</th>
                <th className="px-6 py-5 text-left text-sm font-semibold uppercase tracking-wide" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Wallet</th>
                <th className="px-6 py-5 text-right text-sm font-semibold uppercase tracking-wide cursor-help" title="Total score: 50% volume + 30% consistency + 10% diversity + 10% commitment, multiplied by completion rate factor" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Score</th>
                <th className="px-6 py-5 text-right text-sm font-semibold uppercase tracking-wide cursor-help" title="Total USD value actually spent in DCA purchases" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Volume</th>
                <th className="px-6 py-5 text-right text-sm font-semibold uppercase tracking-wide cursor-help" title="Purchases completed vs total days planned across all DCAs" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Completion</th>
                <th className="px-6 py-5 text-right text-sm font-semibold uppercase tracking-wide cursor-help" title="Number of unique destination tokens purchased" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Bought</th>
                <th className="px-6 py-5 text-right text-sm font-semibold uppercase tracking-wide cursor-help" title="Number of unique source tokens used to pay" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Paid With</th>
                <th className="px-6 py-5 text-right text-sm font-semibold uppercase tracking-wide cursor-help" title="Number of DCA strategies registered" style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>Strategies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {hallOfFame.rankings.map((user, index) => (
                <tr
                  key={user.address}
                  className={`hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/10 dark:to-orange-900/10' : ''
                  }`}
                >
                  <td className="px-6 py-5 sticky left-0 bg-white dark:bg-gray-800 z-10">
                    <div className="flex items-center gap-3">
                      {index < 3 ? (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 border-3 border-yellow-600' :
                          index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 border-3 border-slate-500' :
                          'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900 border-3 border-orange-600'
                        }`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          {user.rank}
                        </div>
                      ) : (
                        <span className="text-lg font-black text-gray-800 dark:text-gray-200 w-12 text-center" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>#{user.rank}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100" style={{ fontFamily: 'SF Mono, Monaco, Consolas, monospace', letterSpacing: '0.02em', fontSize: '13px' }}>
                      {user.address.slice(0, 8)}...{user.address.slice(-6)}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-xl font-semibold text-purple-600 dark:text-purple-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', letterSpacing: '-0.02em', fontWeight: '600' }}>{user.score}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '600' }}>${user.totalUsdVolume.toLocaleString()}</div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ letterSpacing: '0.1em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>USD</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-base font-semibold text-gray-900 dark:text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', letterSpacing: '-0.02em', fontWeight: '600' }}>
                        {user.stats.purchasesExecuted}/{user.stats.totalDaysPlanned}
                      </span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold uppercase ${
                        user.completionRate >= 80 ? 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100' :
                        user.completionRate >= 50 ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100' :
                        'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100'
                      }`} style={{ letterSpacing: '0.05em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '600' }}>
                        {user.completionRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '600' }}>
                      {user.stats.uniqueDestinationTokens}
                    </div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ letterSpacing: '0.1em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>tokens</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '600' }}>
                      {user.stats.uniqueSourceTokens}
                    </div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ letterSpacing: '0.1em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>tokens</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-base font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '600' }}>{user.stats.totalRegistrations}</div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ letterSpacing: '0.1em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>created</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', fontWeight: '800' }}>SCORING FORMULA</h3>
        <div className="mb-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-700">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900 dark:text-white mb-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                How Rankings Work
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                Your score is based primarily on <span className="font-bold text-purple-600 dark:text-purple-400">trading volume</span>. Higher completion rates boost your score, while lower rates reduce it.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 border border-green-200 dark:border-green-800">
                  <div className="font-bold text-green-700 dark:text-green-400 mb-1">Completion Bonuses</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    • 80%+ completion: <span className="font-semibold">+50% boost</span><br/>
                    • 60-80% completion: <span className="font-semibold">+25% boost</span>
                  </div>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 border border-red-200 dark:border-red-800">
                  <div className="font-bold text-red-700 dark:text-red-400 mb-1">Low Completion Penalties</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    • 20-40% completion: <span className="font-semibold">-30% penalty</span><br/>
                    • Under 20%: <span className="font-semibold">-50% penalty</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '700' }}>Volume Score</div>
            <div className="text-xs text-gray-600 dark:text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Primary • √USD × 10</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '700' }}>Completion Multiplier</div>
            <div className="text-xs text-gray-600 dark:text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>% of Volume • Scales with $</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="text-sm text-green-600 dark:text-green-400 font-semibold mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '700' }}>Diversity Bonus</div>
            <div className="text-xs text-gray-600 dark:text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>15% of tokens • Max 50 pts</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <div className="text-sm text-orange-600 dark:text-orange-400 font-semibold mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '700' }}>Consistency Bonus</div>
            <div className="text-xs text-gray-600 dark:text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>10% of rate • Minor impact</div>
          </div>
        </div>
      </div>
    </div>
  );
}
