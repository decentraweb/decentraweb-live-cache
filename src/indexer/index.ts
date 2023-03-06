import { providers } from 'ethers';
import { Redis } from 'ioredis';
import config from '../config';
import BlockProcessor from './BlockProcessor';

const redis = new Redis(config.redis_url);
console.log('PROVIDER', config.ws_url, config.eth_network);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);


const blockProcessor = new BlockProcessor(provider, redis);

blockProcessor.start().then(() => {
  console.log('Started processing eth blocks');
});

export async function resolveAddress(address: string, forceRefresh?: boolean) {
  console.log('resolveAddress', address);
  return '';
}

export async function resolveName(name: string, forceRefresh?: boolean) {
  console.log('resolveName', name);
  return '';
}
