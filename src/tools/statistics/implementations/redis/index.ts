import Redis from 'ioredis';
import type { IStatistics } from '../../interface.js';

export class RedisStatistics implements IStatistics {
  private redis: Redis;
  private readonly PREFIX = 'waiting_game:stats:departures:';

  constructor(redisUrl?: string) {
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis();
  }

  private getTodayKey(): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${this.PREFIX}${today}`;
  }

  async incrementDepartures(): Promise<number> {
    const key = this.getTodayKey();
    const val = await this.redis.incr(key);
    if (val === 1) {
      await this.redis.expire(key, 86400); // 24 hours
    }
    return val;
  }

  async getDeparturesToday(): Promise<number> {
    const key = this.getTodayKey();
    const val = await this.redis.get(key);
    return val ? parseInt(val) : 0;
  }
}
