import { Redis } from 'ioredis';
import config from '../config';
import {ethers, providers} from 'ethers';
import ENSIndex from "./ENSIndex";

const redis = new Redis(config.redis_url);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);


const index = new ENSIndex(redis, provider, config.eth_network);

export function resolveAddress(address: string, forceRefresh?: boolean) {
  return null;
}

export function resolveName(name: string, forceRefresh?: boolean) {
  return null;
}
