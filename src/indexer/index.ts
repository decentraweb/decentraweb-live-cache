import {ethers, providers} from 'ethers';
import { Redis } from 'ioredis';
import config from '../config';
import BlockProcessor from './BlockProcessor';

const redis = new Redis(config.redis_url);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);


const blockProcessor = new BlockProcessor(provider, redis);

blockProcessor.start().then(() => {
  console.log('Started processing eth blocks');
});

export async function resolveAddress(address: string, forceRefresh?: boolean): Promise<string | null> {
  const addr = ethers.utils.getAddress(address);
  const record = await blockProcessor.getName(addr, forceRefresh);
  return record ? record.name : null
}

export async function resolveName(name: string, forceRefresh?: boolean): Promise<string | null> {
  const record = await blockProcessor.getAddress(name, forceRefresh)
  return record ? record.address : null
}
