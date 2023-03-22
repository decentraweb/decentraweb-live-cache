import { ethers, providers } from 'ethers';
import { Redis } from 'ioredis';
import config from '../config';
import BlockProcessor from './BlockProcessor';

const redis = new Redis(config.redis_url);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);

const blockProcessor = new BlockProcessor(provider, redis);

blockProcessor.start().then(() => {
  console.log('Started processing eth blocks');
});
type AddressResolution =
  | {
      name: null;
    }
  | {
      name: string;
      confirmed: boolean;
    };

export async function resolveAddress(
  address: string,
  forceRefresh?: boolean
): Promise<AddressResolution> {
  const addr = ethers.utils.getAddress(address);
  const record = await blockProcessor.getName(addr, forceRefresh);
  if (!record || !record.name) {
    return {
      name: null
    };
  }
  const assignedAddress = await resolveName(record.name, forceRefresh);
  return {
    name: record.name,
    confirmed: assignedAddress === addr
  };
}

export async function resolveName(name: string, forceRefresh?: boolean): Promise<string | null> {
  const record = await blockProcessor.getAddress(name, forceRefresh);
  return record?.address ? ethers.utils.getAddress(record.address) : null;
}
