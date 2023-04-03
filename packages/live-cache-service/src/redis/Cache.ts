import { KEY_PREFIX } from '../lib/constants';
import { Redis } from 'ioredis';

export class Cache<T> {
  readonly name: string;
  private redis: Redis;

  constructor(redis: Redis, name: string) {
    this.redis = redis;
    this.name = `${KEY_PREFIX}:${name}`;
  }

  async get(key: string): Promise<T | null> {
    const data = await this.redis.get(this.getKey(key));
    if (data != null) {
      return JSON.parse(data) as T;
    }
    return null;
  }

  async set(key: string, value: T): Promise<void> {
    await this.redis.set(this.getKey(key), JSON.stringify(value));
  }

  async setMultiple(data: [string, T][]) {
    const pipeline = this.redis.pipeline();
    for (const [key, value] of data) {
      pipeline.set(this.getKey(key), JSON.stringify(value));
    }
    return pipeline.exec();
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  private getKey(key: string): string {
    return `${this.name}:${key}`;
  }
}
