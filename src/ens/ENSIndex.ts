import { Redis } from 'ioredis';
import { ethers, providers } from 'ethers';
import { ENSRegistryWithFallback } from '@ensdomains/ens-contracts';
import { REGISTRY_CREATION_BLOCK } from './constants';
import { CachedHash } from '../redis/CachedHash';

//If no block events received for 30 seconds, we assume that provider is stuck, so we need to restart
const BLOCK_TIMEOUT = 30000;
//Max number of blocks to process in one iteration
const MAX_BLOCKS = 500;

interface ResolverData {
  address: string;
  firstSeen: number;
}

class ENSIndex {
  redis: Redis;
  provider: providers.WebSocketProvider;
  network: string;
  private registry: ethers.Contract | null = null;

  readonly lastProcessedBlockKey = 'ENSIndex:lastProcessedBlock';
  readonly newRegistryEvent = 'NewResolver(bytes32,address)';

  public resolvers: CachedHash<ResolverData>;
  private _lastProcessedBlock: number = 0;
  private _currentBlockNumber: number = 0;
  private iteratingBlocks: boolean = false;
  private blockEventTimeout: NodeJS.Timeout | null = null;

  constructor(redis: Redis, provider: providers.WebSocketProvider, network: string) {
    this.redis = redis;
    this.provider = provider;
    this.network = network;
    this.resolvers = new CachedHash(redis, 'ENSIndex:resolvers');
  }

  async start() {
    this.registry = await this.getRegistry();
    const lastBlock = (await this.redis.get(this.lastProcessedBlockKey)) || '0';
    this._lastProcessedBlock = parseInt(lastBlock) || REGISTRY_CREATION_BLOCK[this.network] || 0;
    this._currentBlockNumber = await this.provider.getBlockNumber();
    await this.resolvers.load();
    console.log(
      `[ENSIndex] Last known block is ${this._lastProcessedBlock}, current block is ${this._currentBlockNumber}`
    );
    if (this._lastProcessedBlock < this._currentBlockNumber) {
      this.iterateBlocks();
    }
    this.provider.on('block', this.handleBlock);
  }

  async getRegistry() {
    const { ensAddress } = await this.provider.getNetwork();
    if (!ensAddress) {
      throw new Error('ENS not supported on this network');
    }
    return new ethers.Contract(ensAddress, ENSRegistryWithFallback, this.provider);
  }

  private handleBlock = (blockNumber: number): void => {
    console.log('New block mined', blockNumber);
    if(this.blockEventTimeout){
      clearTimeout(this.blockEventTimeout);
    }
    this.blockEventTimeout = setTimeout(()=>{
      throw new Error(`No block events received for ${BLOCK_TIMEOUT} ms. Restarting...`);
    }, BLOCK_TIMEOUT);
    if (blockNumber > this._currentBlockNumber) {
      this._currentBlockNumber = blockNumber;
    }
    this.iterateBlocks();
  };

  iterateBlocks = async () => {
    if (this.iteratingBlocks) {
      return;
    }
    this.iteratingBlocks = true;
    while (this._lastProcessedBlock < this._currentBlockNumber) {
      const start = this._lastProcessedBlock + 1;
      const end = Math.min(this._lastProcessedBlock + MAX_BLOCKS, this._currentBlockNumber);
      try {
        await this.processBlocks(start, end);
        await this.redis.set(this.lastProcessedBlockKey, end);
        this._lastProcessedBlock = end;
      } catch (e) {
        this.iteratingBlocks = false;
        throw e;
      }
    }
    this.iteratingBlocks = false;
  };

  async processBlocks(start: number, end: number) {
    console.log(`[ENSIndex] Processing blocks ${start} - ${end}`);
    await this.processResolverEvents(start, end);
  }

  async processResolverEvents(start: number, end: number) {
    const events = await this.registry?.queryFilter(this.newRegistryEvent, start, end);
    if (!events?.length) {
      return;
    }
    for (const event of events) {
      const { args, blockNumber } = event;
      if (!args) {
        console.warn(`No args in event ${event.eventSignature}`);
        return;
      }
      const [node, resolverAddress] = args;
      if (!this.resolvers.get(resolverAddress)) {
        console.log('New resolver', resolverAddress);
        await this.resolvers.set(resolverAddress, {
          address: resolverAddress,
          firstSeen: blockNumber
        });
      }
    }
  }
}

export default ENSIndex;
