import {hash as namehash} from "@ensdomains/eth-ens-namehash";
import {DWEBRegistry} from "@decentraweb/core";
import * as path from "path";
import { providers } from 'ethers';
import {DWEBIndex, AddrRecord, ReverseRecord} from '@decentraweb/dweb-live-cache';
import { Redis } from 'ioredis';
import config from '../config';


const seedDirectory = path.join(__dirname, `../../seed_data/${config.eth_network}`);
const seedBlockNumber: number = require(`${seedDirectory}/block_number.json`);
const ethAddressNodes: Record<string, string> = require(`${seedDirectory}/eth_address_nodes.json`);
const reverseRecordAddresses: Array<string> = require(`${seedDirectory}/reverse_record_addresses.json`);

const redis = new Redis(config.redis_url);
const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);
const dwebRegistry = new DWEBRegistry({provider, network: config.eth_network});

redis
  .flushdb()
  .then(async () => {
    console.log('Seeding DB');
    const blockProcessor = new DWEBIndex(provider, config.redis_url, config.redis_prefix);
    const addresses: Array<[string, AddrRecord]> = Object.entries(ethAddressNodes).map(([node, address]) => {
      return [node, {
        address
      }];
    })
    await blockProcessor.addrCache.setMultiple(addresses);
    const reverseRecords: Array<[string, ReverseRecord]> = await Promise.all(reverseRecordAddresses.map(async (address) => {
      const reverseName = `${address.slice(2)}.addr.reverse`;
      const reverseHash = namehash(reverseName);
      return [reverseHash, {
        name: await dwebRegistry.getReverseRecord(address, true)
      }];
    }));
    await blockProcessor.reverseCache.setMultiple(reverseRecords);
    await redis.set(blockProcessor.lastBlockKey, seedBlockNumber);
    console.log(`Seeded DB at block ${seedBlockNumber}`);
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
