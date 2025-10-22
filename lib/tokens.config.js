export const TOKENS = {
  kBTC: {
    address: "0x73E0C0d45E048D25Fc26Fa3159b0aA04BfA4Db98",
    symbol: "kBTC",
    name: "Kraken Bitcoin",
    decimals: 8,
    logo: "/kbtc_logo.svg",
    isNative: false,
    dcaConfig: [
      {
        source: "USDT0",
      },
      {
        source: "ETH",
      },
    ],
  },

  ETH: {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logo: "/eth_logo.svg",
    isNative: true,
    dcaConfig: [
      {
        source: "USDT0",
      },
    ],
  },

  USDT0: {
    address: "0x0200C29006150606B650577BBE7B6248F58470c1",
    symbol: "USDT0",
    name: "Tether USD",
    decimals: 6,
    logo: "/usdt0_logo.svg",
    isNative: false,
  },

  ANITA: {
    address: "0x0606FC632ee812bA970af72F8489baAa443C4B98",
    symbol: "ANITA",
    name: "Anita",
    decimals: 18,
    logo: "/anita_logo.webp",
    isNative: false,
    dcaConfig: [
      {
        source: "ETH",
      },
      {
        source: "USDT0",
      },
    ],
  }
};


export function getDCATokens() {
  return Object.entries(TOKENS)
    .filter(([_, token]) => token.dcaConfig && token.dcaConfig.length > 0)
    .map(([key, token]) => ({ key, ...token }));
}


export function getDCAConfig(destinationToken, sourceToken) {
  const token = TOKENS[destinationToken];
  if (!token || !token.dcaConfig) return null;

  return token.dcaConfig.find(config => config.source === sourceToken);
}


export function getAvailableSourceTokens(destinationToken) {
  const token = TOKENS[destinationToken];
  if (!token || !token.dcaConfig) return [];

  return token.dcaConfig.map(config => ({
    ...TOKENS[config.source],
    key: config.source,
  }));
}



export function getSwapPath(sourceToken, destinationToken) {
  return [TOKENS[sourceToken].address, TOKENS[destinationToken].address];
}
