import TokenCard from "../components/TokenCard";
import { getDCATokens } from "../../lib/tokens.config";


export default function TokenSelectionPage({ onSelectDCA }) {
  const dcaTokens = getDCATokens();

  return (
    <div className="space-y-6">
      {}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Choose Your DCA Strategy
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Select a token and source to start your automated dollar-cost averaging
        </p>
      </div>

      {}
      <div className="grid gap-6 max-w-4xl mx-auto">
        {dcaTokens.map(({ key, ...token }) => (
          <TokenCard
            key={key}
            tokenKey={key}
            token={token}
            onSelectDCA={onSelectDCA}
          />
        ))}
      </div>

      {}
      <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 max-w-4xl mx-auto">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">💡 Tip:</span> Each token may have multiple
          DCA options with different source currencies. Compare the stats to choose
          the best option for you.
        </p>
      </div>
    </div>
  );
}
