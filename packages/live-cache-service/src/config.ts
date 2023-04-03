import dotenv from 'dotenv';
import { EthNetwork } from '@decentraweb/core';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '') || 3000,
  redis_url: process.env.REDIS_URL as string,
  ws_url: process.env.WEBSOCKET_URL as string,
  eth_network: process.env.ETH_NETWORK as EthNetwork,
  redis_prefix: process.env.REDIS_PREFIX || 'live-cache',
};

export default config;
