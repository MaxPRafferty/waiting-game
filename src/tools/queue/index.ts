import { MockQueue } from './implementations/mock/index.js';
import { RedisQueue } from './implementations/redis/index.js';
import type { IQueue } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const redisUrl = process.env.REDIS_URL;

export const queue: IQueue = mode === 'LIVE' 
  ? new RedisQueue(redisUrl) 
  : new MockQueue();
