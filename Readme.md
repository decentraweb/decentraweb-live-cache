# Decentraweb Ethereum Address Resolution Cache
This monorepo contain package that aims to maintain name-to-address and address-to-name cache that is updated in realtime. 
Also, here you can find simple web service that uses this package to provide REST API for name and address resolution.
## Setup
To start service do following:
1. Clone repository
2. Run `npm install --foreground-scripts`
3. Run `lerna bootstrap`
4. Copy `.env.example` file to `.env` and set `REDIS_URL`, `ETH_NETWORK` and `WEBSOCKET_URL`. For the `WEBSOCKET_URL` specify a blockchain node, for example [Infura](https://www.infura.io/). Websocket is preferred over HTTP for massive indexing performance. Note that we don't recommend Alchemy API as it is known to cause errors.

**Note** Currently only `mainnet` and `goerli` networks are supported.

For more technical details regarding cache check [dweb-live-cache](packages/dweb-live-cache) package readme. In following
sections we will cover how to start and use simple cache web service.

## Seeding DB
There is `packages/dweb-live-cache/seed_data` directory that contains JSON files with seed data pulled from specific ETH network at specific block number.
This allows to skip indexing all blocks since resolver contracts were deployed.

Before seeding DB make sure that `.env` file is configured properly.

To seed DB run `npm run seed` command.

## Running service
To start service run `npm start` command. Service will start indexing `AddrChanged(bytes32,address)` and 
`NameChanged(bytes32,string)` events on `PublicResolver` and `DefaultReverseResolver` contracts.

Indexing starts from last indexed block number. If there is no data in DB service will start indexing from block number 
specified in [constants.ts](packages/dweb-live-cache/src/dweb/constants.ts). This is number of block when `PublicResolver` and
`DefaultReverseResolver` were deployed.

As the service indexing block it listens for `block` events on provider to keep track of every new block.

If service is crashed or stopped it will continue indexing from last indexed block number.

## REST API
Resolution uses Redis to store name and address cache. To force cache refresh simply add `refresh=1` to querystring.
### Resolve single name to address
```shell
curl --location --request GET 'http://localhost:3000/name/serhii'
```
Sample response:
```json
{
  "success": true,
  "result": "0x13BCb838DAEFF08f4E56237098dB1d814eeB837D"
}
```
### Resolve multiple names to address
Request:
```shell
curl --location --request POST 'http://localhost:3000/name/batch' \
--header 'Content-Type: application/json' \
--data-raw '[
    "serhii", "mauvis"
]'
```
Sample response:
```json
{
  "success": true,
  "result": [
    {
      "name": "serhii",
      "success": true,
      "address": "0x13BCb838DAEFF08f4E56237098dB1d814eeB837D"
    },
    {
      "name": "mauvis",
      "success": true,
      "address": null
    }
  ]
}
```
### Resolve single address to name
```shell
curl --location --request GET 'http://localhost:3000/address/0x13BCb838DAEFF08f4E56237098dB1d814eeB837D'
```
Sample response:
```json
{
  "success": true,
  "result": {
    "name": "serhii",
    "confirmed": true
  }
}
```

### Resolve multiple addresses to names
Request:
```shell
curl --location --request POST 'http://localhost:3000/address/batch' \
--header 'Content-Type: application/json' \
--data-raw '[
    "0x13BCb838DAEFF08f4E56237098dB1d814eeB837D"
]'
```
Sample response:
```json
{
  "success": true,
  "result": [
    {
      "address": "0x13BCb838DAEFF08f4E56237098dB1d814eeB837D",
      "success": true,
      "name": "serhii",
      "confirmed": true
    }
  ]
}
```
