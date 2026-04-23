import { MockStatistics } from './implementations/mock/index.js';
import { RedisStatistics } from './implementations/redis/index.js';
import type { IStatistics } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const redisUrl = process.env.REDIS_URL;

export const statistics: IStatistics = mode === 'LIVE' 
  ? new RedisStatistics(redisUrl) 
  : new MockStatistics();
