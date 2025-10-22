
import ThemeToggle from "../components/ThemeToggle";

export default function LandingPage({ onConnect }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/ink_dca_logo.png" alt="DCA on Ink" className="w-10 h-10" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                DCA on <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Ink</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={onConnect}
                className="px-6 py-2.5 bg-gray-900 dark:bg-purple-600 text-white font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-purple-700 transition-colors"
              >
                Launch App
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-full text-sm font-medium text-purple-700 dark:text-purple-300 mb-6">
                <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse"></span>
                Trustless DCA on Ink
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Automate Your Crypto Investments
              </h1>

              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Set up dollar-cost averaging strategies for kBTC, ETH, and other tokens.
                No manual intervention needed. Your investments run on autopilot with guaranteed execution.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button
                  onClick={onConnect}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-semibold rounded-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  Start Investing Now
                </button>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">100%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Trustless</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">24/7</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Automated</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">0%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Hidden Fees</p>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative">
              <div className="relative z-10 bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 rounded-3xl p-8 shadow-2xl">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-white/80 text-sm font-medium">Your DCA Strategy</span>
                    <span className="px-3 py-1 bg-green-400 text-green-900 text-xs font-semibold rounded-full">Active</span>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between text-white">
                      <span className="text-sm opacity-80">Investment Amount</span>
                      <span className="text-lg font-bold">$100</span>
                    </div>
                    <div className="flex items-center justify-between text-white">
                      <span className="text-sm opacity-80">Frequency</span>
                      <span className="text-lg font-bold">Daily</span>
                    </div>
                    <div className="flex items-center justify-between text-white">
                      <span className="text-sm opacity-80">Target Asset</span>
                      <span className="text-lg font-bold">kBTC</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/20">
                    <div className="flex items-center justify-between text-white mb-2">
                      <span className="text-sm opacity-80">Next Purchase</span>
                      <span className="text-sm font-semibold">In 4 hours</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div className="bg-gradient-to-r from-green-400 to-blue-400 h-2 rounded-full" style={{width: '65%'}}></div>
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl opacity-20 blur-2xl"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl opacity-20 blur-2xl"></div>
              </div>

              {/* Background Decoration */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-purple-200 to-pink-200 rounded-3xl -z-10 blur-3xl opacity-30"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Built for Smart Investors
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to automate your crypto investment strategy on Ink
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-700 dark:from-purple-500 dark:to-purple-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Scheduled Execution</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Set your preferred time and frequency. Your DCA executes automatically at the exact time you choose, every single day.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-br from-pink-600 to-pink-700 dark:from-pink-500 dark:to-pink-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Fully Trustless</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Your funds never leave your control. All execution happens on-chain through smart contracts with complete transparency.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Optimal Pricing</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Automatically routes through Uniswap V2 to ensure you get the best available price for every purchase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Three simple steps to automate your crypto investments
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Wallet</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Connect your Web3 wallet to Ink network. No account creation or KYC required.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Configure Strategy</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Choose your token pair, set your daily investment amount, and select your preferred execution time.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Let It Run</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Your DCA executes automatically. Monitor your portfolio and adjust your strategy anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Start Your DCA Strategy?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join smart investors who automate their crypto purchases with trustless, on-chain execution.
          </p>
          <button
            onClick={onConnect}
            className="px-10 py-5 bg-white text-purple-700 text-lg font-bold rounded-xl hover:bg-gray-50 shadow-2xl hover:scale-105 transition-all duration-200"
          >
            Connect Wallet & Launch App
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/ink_dca_logo.png" alt="DCA on Ink" className="w-8 h-8" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white">DCA on Ink</span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <a
                href="/terms-of-service.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium underline"
              >
                Terms of Service
              </a>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                InkDCA © {new Date().getFullYear()} • Built with ❤️ for the Ink community
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
