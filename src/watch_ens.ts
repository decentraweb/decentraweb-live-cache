import { Redis } from 'ioredis';
import config from './config';
import { providers } from 'ethers';
import ENSIndex from './ens/ENSIndex';
import ContractValidator, { ContractType } from './ens/ContractValidator';

const redis = new Redis(config.redis_url);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);

const index = new ENSIndex(redis, provider, config.eth_network);

process.nextTick(async () => {
  await index.resolvers.load();
  const validator = new ContractValidator(provider);
  const resolvers = index.resolvers.data;
  let count = 0;
  for (const [address, resolver] of Object.entries(resolvers)) {
    const result = await validator.validateContract(resolver.address);
    if(result === ContractType.RESOLVER) {
      console.log('RESOLVER',address, result);
      count++;
    }
  }
  console.log('RESOLVERS', count);
});

/*index.start().then(() => {
  console.log('Started processing eth blocks');
});*/
