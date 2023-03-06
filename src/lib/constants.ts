export const KEY_PREFIX = 'dweb-cache';

export const EMPTY_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

type EthNetwork = 'mainnet' | 'goerli';

export const START_BLOCK: Record<EthNetwork, number> = {
  mainnet: 16731314,
  goerli: 7590847
};
