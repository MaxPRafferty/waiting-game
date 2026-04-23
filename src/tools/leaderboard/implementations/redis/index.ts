import Redis from 'ioredis';
import type { ILeaderboard, WinnerEntry } from '../../interface.js';

export class RedisLeaderboard implements ILeaderboard {
  private redis: Redis;
  private readonly LEADERBOARD_KEY = 'waiting_game:leaderboard';
  private readonly WINNERS_PREFIX = 'waiting_game:winners:';

  constructor(redisUrl?: string) {
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis();
  }

  async addWinner(seq: number, position: number, duration_ms: number): Promise<void> {
    const timestamp = Date.now();
    const winnerData: WinnerEntry = { seq, position, duration_ms, timestamp };
    
    await this.redis.pipeline()
      .zadd(this.LEADERBOARD_KEY, timestamp, seq.toString())
      .hset(`${this.WINNERS_PREFIX}${seq}`, 'data', JSON.stringify(winnerData))
      .exec();
  }

  async getRecentWinners(limit: number): Promise<WinnerEntry[]> {
    // Get most recent winners by timestamp (score)
    const seqs = await this.redis.zrevrange(this.LEADERBOARD_KEY, 0, limit - 1);
    if (seqs.length === 0) return [];

    const winners: WinnerEntry[] = [];
    for (const seq of seqs) {
      const data = await this.redis.hget(`${this.WINNERS_PREFIX}${seq}`, 'data');
      if (data) {
        winners.push(JSON.parse(data));
      }
    }
    return winners;
  }
}
