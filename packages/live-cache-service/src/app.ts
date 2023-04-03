import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import config from './config';
import { isArray } from 'lodash';
import UserError from './lib/errors/UserError';
import { providers } from 'ethers';
import { DWEBIndex } from '@decentraweb/dweb-live-cache';

const provider = new providers.WebSocketProvider(config.ws_url, config.eth_network);

const dwebIndex = new DWEBIndex(provider, config.redis_url, config.redis_prefix);

dwebIndex.start().then(() => {
  console.log('Started processing eth blocks');
});

const app = new Koa();

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: any) {
    console.error(err);
    // will only respond with JSON
    ctx.status = err.statusCode || err.status || 500;
    ctx.body = {
      success: false,
      message: err.userMessage || 'Unexpected error'
    };
  }
});

app.use(koaBody());

const router = new Router();

router.get('/health-check', (ctx) => {
  ctx.body = { success: true };
});

router.get('/address/:address', async (ctx) => {
  ctx.body = {
    success: true,
    result: await dwebIndex.resolveAddress(ctx.params.address, ctx.query.refresh === '1')
  };
});

router.post('/address/batch', async (ctx) => {
  if (!isArray(ctx.request.body)) {
    throw new UserError('Request body must be array of ETH addresses!');
  }
  const forceRefresh = ctx.query.refresh === '1';
  const promises = ctx.request.body.map((address: string) => {
    return dwebIndex
      .resolveAddress(address, forceRefresh)
      .then((result) => {
        return {
          address,
          success: true,
          ...result
        };
      })
      .catch((e) => {
        console.error(e);
        return {
          address,
          success: false
        };
      });
  });
  ctx.body = {
    success: true,
    result: await Promise.all(promises)
  };
});

router.get('/name/:name', async (ctx) => {
  ctx.body = {
    success: true,
    result: await dwebIndex.resolveName(ctx.params.name, ctx.query.refresh === '1')
  };
});

router.post('/name/batch', async (ctx) => {
  if (!isArray(ctx.request.body)) {
    throw new UserError('Request body must be array of domains!');
  }
  const promises = ctx.request.body.map((name: string) => {
    const forceRefresh = ctx.query.refresh === '1';
    return dwebIndex
      .resolveName(name, forceRefresh)
      .then((address) => {
        return {
          name,
          success: true,
          address
        };
      })
      .catch((e) => {
        console.error(e);
        return {
          name,
          success: false
        };
      });
  });
  ctx.body = {
    success: true,
    result: await Promise.all(promises)
  };
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(config.port);
