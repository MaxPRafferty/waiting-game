import { MockEndurance } from './implementations/mock/index.js';
import { RedisEndurance } from './implementations/redis/index.js';
import type { IEndurance } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const redisUrl = process.env.REDIS_URL;

export const endurance: IEndurance = mode === 'LIVE'
  ? new RedisEndurance(redisUrl)
  : new MockEndurance();
