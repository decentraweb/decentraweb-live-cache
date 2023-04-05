# Live Cache for Decentraweb
One of the main features of Decentraweb is resolving domain names to Ethereum addresses and addresses to names. 
Normally, this is done by querying the Ethereum blockchain. In some cases, this can be slow, especially with batch operations.
This package allows you to create Redis cache that will be updated automatically by listening on conract events.
## Installation
```bash
npm install --save @decentraweb/dweb-live-cache
#OR
yarn add @decentraweb/dweb-live-cache
```

## Instantiating the cache
To start using the cache, you need to instantiate it. The cache is a class that takes 3 parameters:
1. `provider` - an instance of `ethers.js` provider
2. `redisUrl` - a URL to the Redis server
3. `keyPrefix` - refix that will be added to all Redis keys
```typescript
import { DWEBIndex } from '@decentraweb/dweb-live-cache';
const provider = new providers.WebSocketProvider('wss://example.com/0000000000000000000000000000000', 'mainnet');
const dwebIndex = new DWEBIndex(provider, 'redis://localhost:6379', 'dweb-cache');
```
## Seeding the cache
When starting new cache instance, you need to pre-populate it with initial data. 
This can be done by calling `seed` method:
```typescript
import { DWEBIndex } from '@decentraweb/dweb-live-cache';
const provider = new providers.WebSocketProvider(WS_URL, ETH_NETWORK);
const dwebIndex = new DWEBIndex(provider, REDIS_URL, REDIS_PREFIX);
await dwebIndex.seedCache();
```
## Listening for events
For each cache instance you need to have one process that will listen for events and update the cache. You can run `live-cache-service`
app from our [repo](https://github.com/decentraweb/decentraweb-live-cache) or write your own script that will 
instantiate the cache and call `start` method:
```typescript
import { DWEBIndex } from '@decentraweb/dweb-live-cache';
const provider = new providers.WebSocketProvider(WS_URL, ETH_NETWORK);
const dwebIndex = new DWEBIndex(provider, REDIS_URL, REDIS_PREFIX);

dwebIndex.start().then(() => {
  console.log('Started processing eth blocks');
});
```
**Notes:** 
1. Make sure to have only one listener per cache instance.
2. Receiving events is crucial for cache reliability. So if no `block` events received for 30 seconds, cache 
will throw an error as it means that connection to the blockchain is lost.

After calling start, cache will check which block was last processed and will start processing from that block until the latest one.
Also cache class will subscribe to `block` event on contract. On each new block it will query DWEB 
`PublicResolver` and `DefaultReverseResolver` contract events to detect changes in Ethereum address assignment.
## Using the cache
To query data, you can create multiple instances of `DWEBIndex` class. There are 2 main methods:
1. `resolveAddress(address: string, forceRefresh?: boolean): Promise<AddressResolution>` - to resolve Ethereum address to name
2. `resolveName(name: string, forceRefresh?: boolean): Promise<string | null>` - to resolve name to Ethereum address
`forceRefresh` parameter is optional and can be used to force class to query the blockchain instead of using cached data.
```typescript
import { DWEBIndex } from '@decentraweb/dweb-live-cache';
const provider = new providers.WebSocketProvider(WS_URL, ETH_NETWORK);
const dwebIndex = new DWEBIndex(provider, REDIS_URL, REDIS_PREFIX);

const address = await dwebIndex.resolveName('notyourbro');
// returns '0xcB3E45F337Dd3Beeba98F5F9F9A16e9cD152cC86'
const nameResult = await dwebIndex.resolveAddress('0xcB3E45F337Dd3Beeba98F5F9F9A16e9cD152cC86');
// returns { name: 'notyourbro', confirmed: true }
```
**Note:** Address to name resolution includes so-called "forward check". When user is creating reverse resolution 
record for their wallet, they can assign any random name. To confirm that the name is actually owned by the user, 
we resolve name to Ethereum address and check that it matches the address we are resolving. `confirmed` flag in result is
indicating if forward check was successful.
