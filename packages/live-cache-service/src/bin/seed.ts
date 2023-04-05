import { providers } from 'ethers';
import {DWEBIndex} from '@decentraweb/dweb-live-cache';
import { Redis } from 'ioredis';
import config from '../config';


const redis = new Redis(config.redis_url);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);

redis
  .flushdb()
  .then(async () => {
    const dwebIndex = new DWEBIndex(provider, config.redis_url, config.redis_prefix);
    return dwebIndex.seedCache();
  })
  .catch((err: Error) => {
    console.log('Failed to seed DB');
    console.error(err);
    return redis.flushdb();
  })
  .then(() => {
    console.log('Shutting down');
    process.exit(0);
  });
