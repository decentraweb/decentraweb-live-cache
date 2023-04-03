import { Redis } from 'ioredis';
import config from '../config';
const redis = new Redis(config.redis_url);

redis
  .flushdb()
  .then(async () => {
    console.log('Cleaned DB');
  })
  .catch((err: Error) => {
    console.log('Failed to clean DB');
    console.error(err);
    return redis.flushdb();
  })
  .then(() => {
    console.log('Shutting down');
    process.exit(0);
  });
