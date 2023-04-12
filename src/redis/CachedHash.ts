import { KEY_PREFIX } from '../lib/constants';
import { Redis } from 'ioredis';

export class CachedHash<T> {
  readonly name: string;
  private redis: Redis;
  private _data: Map<string, T> = new Map();

  get data() {
    return Object.fromEntries(this._data);
  }

  constructor(redis: Redis, name: string) {
    this.redis = redis;
    this.name = `${KEY_PREFIX}:${name}`;
  }

  async load() {
    const data = await this.redis.hgetall(this.name);
    const _data = new Map();
    for (const [key, value] of Object.entries(data)) {
      _data.set(key, JSON.parse(value) as T);
    }
    this._data = _data;
  }

  get(key: string): T | null {
    if (this._data.has(key)) {
      return this._data.get(key) as T;
    }
    return null;
  }

  async set(key: string, value: T): Promise<void> {
    this._data.set(key, value);
    await this.redis.hset(this.name, key, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    this._data.delete(key);
    await this.redis.hdel(this.name, key);
  }

  async save(): Promise<void> {
    const data = [...this._data.entries()].reduce((acc, [key, value]) => {
      acc[key] = JSON.stringify(value);
      return acc;
    }, {} as Record<string, string>);
    await this.redis.hmset(this.name, data);
  }
}
