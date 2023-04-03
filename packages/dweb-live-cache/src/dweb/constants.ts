type EthNetwork = 'mainnet' | 'goerli';

export const START_BLOCK: Record<EthNetwork, number> = {
  mainnet: 14724819, //Block number at whcih the resolver contract was deployed
  goerli: 7590847
};
