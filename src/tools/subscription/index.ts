import { InMemorySubscription } from './implementations/mock/index.js';
import { RedisSubscription } from './implementations/redis/index.js';
import type { ISubscription } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const redisUrl = process.env.REDIS_URL;

export const subscription: ISubscription = mode === 'LIVE'
  ? new RedisSubscription(redisUrl)
  : new InMemorySubscription();
