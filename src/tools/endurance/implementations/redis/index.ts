import Redis from 'ioredis';
import type { IEndurance, EnduranceEntry } from '../../interface.js';

export class RedisEndurance implements IEndurance {
  private redis: Redis;
  private readonly KEY = 'waiting_game:endurance';
  private readonly META_KEY = 'waiting_game:endurance_meta';

  constructor(redisUrl?: string) {
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis();
  }

  async addEntry(seq: number, duration_ms: number): Promise<void> {
    const member = String(seq);
    await this.redis.zadd(this.KEY, duration_ms, member);
    await this.redis.hset(this.META_KEY, member, JSON.stringify({ timestamp: Date.now() }));
  }

  async getTop(limit: number): Promise<EnduranceEntry[]> {
    const raw = await this.redis.zrevrange(this.KEY, 0, limit - 1, 'WITHSCORES');
    const entries: EnduranceEntry[] = [];

    for (let i = 0; i < raw.length; i += 2) {
      const seq = parseInt(raw[i]);
      const duration_ms = parseInt(raw[i + 1]);
      const metaStr = await this.redis.hget(this.META_KEY, raw[i]);
      const meta = metaStr ? JSON.parse(metaStr) : { timestamp: 0 };
      entries.push({ seq, duration_ms, timestamp: meta.timestamp });
    }

    return entries;
  }
}
