import { MockLeaderboard } from './implementations/mock/index.js';
import { RedisLeaderboard } from './implementations/redis/index.js';
import type { ILeaderboard } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const redisUrl = process.env.REDIS_URL;

export const leaderboard: ILeaderboard = mode === 'LIVE' 
  ? new RedisLeaderboard(redisUrl) 
  : new MockLeaderboard();
