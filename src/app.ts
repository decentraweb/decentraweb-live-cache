import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import config from './config';
import { resolveAddress, resolveName } from './indexer';
import { isArray } from 'lodash';
import UserError from './lib/errors/UserError';

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
    result: await resolveAddress(ctx.params.address, ctx.query.refresh === '1')
  };
});

router.post('/address/batch', async (ctx) => {
  if (!isArray(ctx.request.body)) {
    throw new UserError('Request body must be array of ETH addresses!');
  }
  const forceRefresh = ctx.query.refresh === '1';
  const promises = ctx.request.body.map((address: string) => {
    return resolveAddress(address, forceRefresh)
      .then((name) => {
        return {
          address,
          success: true,
          name
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
    result: await resolveName(ctx.params.name, ctx.query.refresh === '1')
  };
});

router.post('/name/batch', async (ctx) => {
  if (!isArray(ctx.request.body)) {
    throw new UserError('Request body must be array of domains!');
  }
  const promises = ctx.request.body.map((name: string) => {
    const forceRefresh = ctx.query.refresh === '1';
    return resolveName(name, forceRefresh)
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
