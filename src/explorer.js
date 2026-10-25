const explorers = {
  mainnet: 'https://flonscan.io',
  testnet: 'https://testnet.flonscan.io',
};

export function accountExplorerUrl(network, account) {
  const base = explorers[network];
  return base ? `${base}/account/${encodeURIComponent(account)}` : null;
}
