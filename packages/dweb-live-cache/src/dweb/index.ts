import { ethers, providers } from 'ethers';
import { Redis } from 'ioredis';
import { DWEBRegistry, EthNetwork } from '@decentraweb/core';
import { hash as namehash } from '@ensdomains/eth-ens-namehash';
import { getContract, getContractConfig } from '@decentraweb/core/build/contracts';
import { Cache } from '../lib/Cache';
import { START_BLOCK } from './constants';

//If no block events received for 30 seconds, we assume that provider is stuck, so we need to restart
const BLOCK_TIMEOUT = 30000;
//Max number of blocks to process in one iteration
const MAX_BLOCKS = 500;

interface EventIdx {
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
}

export type AddressResolution =
  | {
      name: null;
    }
  | {
      name: string;
      confirmed: boolean;
    };

export interface AddrRecord {
  eventId?: EventIdx;
  address: string | null;
}

export interface ReverseRecord {
  eventId?: EventIdx;
  name: string | null;
}

export class DWEBIndex {
  private _lastProcessedBlock: number = 0;
  private _currentBlockNumber: number = 0;
  private provider: providers.BaseProvider;
  private redis: Redis;
  private blockEventTimeout: NodeJS.Timeout | null = null;
  private _dwebRegistry: DWEBRegistry | null = null;
  private resolver: ethers.Contract | null = null;
  private reverseResolver: ethers.Contract | null = null;

  readonly lastBlockKey: string;
  readonly addrCache: Cache<AddrRecord>;
  readonly reverseCache: Cache<ReverseRecord>;

  readonly addrEvent = 'AddrChanged(bytes32,address)';
  readonly reverseEvent = 'NameChanged(bytes32,string)';

  private iteratingBlocks: boolean = false;

  get lastProcessedBlock() {
    return this._lastProcessedBlock;
  }

  get currentBlockNumber() {
    return this._currentBlockNumber;
  }

  constructor(provider: providers.BaseProvider, redisUrl: string, keyPrefix: string) {
    this.provider = provider;
    this.redis = new Redis(redisUrl);
    this.lastBlockKey = `${keyPrefix}:dweb:lastKnownBlock`;
    this.addrCache = new Cache<AddrRecord>(this.redis, `${keyPrefix}:dweb:addr`);
    this.reverseCache = new Cache<ReverseRecord>(this.redis, `${keyPrefix}:dweb:reverse`);
  }

  public start = async (): Promise<void> => {
    const networkName = await this.detectNetwork();
    console.log(`Starting block processor for ${networkName}`);
    const contractConfig = getContractConfig(networkName);
    this.resolver = getContract({
      address: contractConfig.PublicResolver,
      provider: this.provider,
      name: 'PublicResolver'
    });
    this.reverseResolver = getContract({
      address: contractConfig.DefaultReverseResolver,
      provider: this.provider,
      name: 'DefaultReverseResolver'
    });
    const lastBlock = (await this.redis.get(this.lastBlockKey)) || '0';
    this._lastProcessedBlock = parseInt(lastBlock) || START_BLOCK[networkName];
    this._currentBlockNumber = await this.provider.getBlockNumber();
    console.log(`Started listening for blocks.`);
    console.log(
      `Last known block is ${this._lastProcessedBlock}, we are ${
        this._currentBlockNumber - this._lastProcessedBlock
      } blocks behind.`
    );
    if (this._lastProcessedBlock < this._currentBlockNumber) {
      this.iterateBlocks();
    }
    this.provider.on('block', this.handleBlock);
  };

  async detectNetwork(): Promise<EthNetwork> {
    const network = await this.provider.getNetwork();
    if (network.name === 'homestead') {
      return 'mainnet';
    }
    return network.name as EthNetwork;
  }

  async dwebRegistry() {
    if (!this._dwebRegistry) {
      const networkName = await this.detectNetwork();
      this._dwebRegistry = new DWEBRegistry({ provider: this.provider, network: networkName });
    }
    return this._dwebRegistry;
  }

  private handleBlock = (blockNumber: number): void => {
    console.log('New block mined', blockNumber);
    if (this.blockEventTimeout) {
      clearTimeout(this.blockEventTimeout);
    }
    this.blockEventTimeout = setTimeout(() => {
      throw new Error(`No block events received for ${BLOCK_TIMEOUT} ms. Restarting...`);
    }, BLOCK_TIMEOUT);
    if (blockNumber > this._currentBlockNumber) {
      this._currentBlockNumber = blockNumber;
    }
    this.iterateBlocks();
  };

  private iterateBlocks = async (): Promise<void> => {
    if (this.iteratingBlocks) {
      return;
    }
    this.iteratingBlocks = true;
    while (this._lastProcessedBlock < this._currentBlockNumber) {
      const start = this._lastProcessedBlock + 1;
      const end = Math.min(this._lastProcessedBlock + MAX_BLOCKS, this._currentBlockNumber);
      try {
        await this.processBlock(start, end);
        await this.redis.set(this.lastBlockKey, end);
        this._lastProcessedBlock = end;
      } catch (e) {
        this.iteratingBlocks = false;
        throw e;
      }
    }
    this.iteratingBlocks = false;
  };

  private processBlock = async (startBlock: number, endBlock: number): Promise<void> => {
    console.log(`Process block ${startBlock} - ${endBlock}`);
    await Promise.all([
      this.processAddrEvents(startBlock, endBlock),
      this.processReverseEvents(startBlock, endBlock)
    ]);
  };

  private async processAddrEvents(startBlock: number, endBlock: number) {
    const events = await this.resolver?.queryFilter(this.addrEvent, startBlock, endBlock);
    if (!events) {
      return;
    }
    const data: Array<[string, AddrRecord]> = [];
    for (const event of events) {
      const { args, blockNumber, transactionIndex, logIndex } = event;
      if (!args) {
        console.warn(`No args in event ${event.eventSignature}`);
        continue;
      }
      const [namehash, addr] = args;
      data.push([
        namehash,
        {
          eventId: {
            blockNumber,
            transactionIndex,
            logIndex
          },
          address: addr
        }
      ]);
    }
    await this.addrCache.setMultiple(data);
  }

  private async processReverseEvents(startBlock: number, endBlock: number) {
    const events = await this.reverseResolver?.queryFilter(this.reverseEvent, startBlock, endBlock);
    if (!events) {
      return;
    }
    const data: Array<[string, ReverseRecord]> = [];
    for (const event of events) {
      const { args, blockNumber, transactionIndex, logIndex } = event;
      if (!args) {
        console.warn(`No args in event ${event.eventSignature}`);
        return;
      }
      const [nodehash, name] = args;
      data.push([
        nodehash,
        {
          eventId: {
            blockNumber,
            transactionIndex,
            logIndex
          },
          name
        }
      ]);
    }
    await this.reverseCache.setMultiple(data);
  }

  public status() {
    return {
      lastProcessedBlock: this._lastProcessedBlock,
      currentBlockNumber: this._currentBlockNumber
    };
  }

  public async getAddress(
    domain: string,
    forceRefresh: boolean = false
  ): Promise<AddrRecord | null> {
    const domainHash = namehash(domain);
    if (!forceRefresh) {
      return this.addrCache.get(domainHash);
    }
    const registry = await this.dwebRegistry();
    const address = await registry.name(domain).getAddress();
    await this.addrCache.set(domainHash, { address });
    return { address };
  }

  public async getName(
    address: string,
    forceRefresh: boolean = false
  ): Promise<ReverseRecord | null> {
    const addr = ethers.utils.getAddress(address);
    const reverseName = `${addr.slice(2)}.addr.reverse`;
    const reverseHash = namehash(reverseName);
    if (!forceRefresh) {
      return this.reverseCache.get(reverseHash);
    }
    const registry = await this.dwebRegistry();
    const name = await registry.getReverseRecord(addr);
    await this.reverseCache.set(reverseHash, { name });
    return { name };
  }

  async resolveAddress(address: string, forceRefresh?: boolean): Promise<AddressResolution> {
    const record = await this.getName(address, forceRefresh);
    if (!record || !record.name) {
      return {
        name: null
      };
    }
    const assignedAddress = await this.resolveName(record.name, forceRefresh);
    return {
      name: record.name,
      confirmed: assignedAddress === address
    };
  }

  async resolveName(name: string, forceRefresh?: boolean): Promise<string | null> {
    const record = await this.getAddress(name, forceRefresh);
    return record?.address ? ethers.utils.getAddress(record.address) : null;
  }
}

export default DWEBIndex;
