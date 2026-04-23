import Redis from 'ioredis';
import type { SlotSummary } from './types.js';

export interface QueueClient {
  seq: number;
  token: string;
  checked: boolean;
  joined_at: number;
}

export class QueueStore {
  private redis: Redis;
  private readonly QUEUE_KEY = 'waiting_game:queue';
  private readonly STATE_KEY = 'waiting_game:states';
  private readonly SEQ_KEY = 'waiting_game:seq_counter';

  constructor(redisUrl?: string) {
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis();
  }

  async add(token: string): Promise<QueueClient> {
    const seq = await this.redis.incr(this.SEQ_KEY);
    const joined_at = Date.now();
    
    // Use a pipeline for atomicity
    await this.redis.pipeline()
      .zadd(this.QUEUE_KEY, seq, token)
      .hset(this.STATE_KEY, token, JSON.stringify({
        seq,
        joined_at,
        checked: false
      }))
      .exec();

    return { seq, token, checked: false, joined_at };
  }

  async remove(token: string): Promise<QueueClient | null> {
    const stateStr = await this.redis.hget(this.STATE_KEY, token);
    if (!stateStr) return null;

    const state = JSON.parse(stateStr);
    
    await this.redis.pipeline()
      .zrem(this.QUEUE_KEY, token)
      .hdel(this.STATE_KEY, token)
      .exec();

    return { token, ...state };
  }

  async get(token: string): Promise<QueueClient | null> {
    const stateStr = await this.redis.hget(this.STATE_KEY, token);
    if (!stateStr) return null;
    return { token, ...JSON.parse(stateStr) };
  }

  async getPosition(token: string): Promise<number> {
    const rank = await this.redis.zrank(this.QUEUE_KEY, token);
    return rank ?? -1;
  }

  async isEligible(token: string): Promise<boolean> {
    const client = await this.get(token);
    if (!client || client.checked) return false;

    // Rank 0 is eligible
    const rank = await this.redis.zrank(this.QUEUE_KEY, token);
    return rank === 0;
  }

  async check(token: string): Promise<{ success: boolean; seq: number; position: number; duration_ms: number }> {
    const client = await this.get(token);
    if (!client || client.checked) {
      return { success: false, seq: -1, position: -1, duration_ms: 0 };
    }

    const rank = await this.redis.zrank(this.QUEUE_KEY, token);
    if (rank !== 0) {
      return { success: false, seq: -1, position: -1, duration_ms: 0 };
    }

    client.checked = true;
    const duration_ms = Date.now() - client.joined_at;

    await this.redis.hset(this.STATE_KEY, token, JSON.stringify({
      seq: client.seq,
      joined_at: client.joined_at,
      checked: true
    }));

    return {
      success: true,
      seq: client.seq,
      position: 0,
      duration_ms
    };
  }

  // Get a range of slots, filling gaps with 'phantom' data if needed for the mock
  async getRange(fromPos: number, toPos: number, offset: number, total: number): Promise<SlotSummary[]> {
    const summaries: SlotSummary[] = [];
    
    // Get tokens in the requested range (adjusted for mock offset)
    const start = Math.max(0, fromPos - offset);
    const end = Math.max(0, toPos - offset);
    
    const tokens = await this.redis.zrange(this.QUEUE_KEY, start, end);
    const states = tokens.length > 0 ? await this.redis.hmget(this.STATE_KEY, ...tokens) : [];

    const realClientsMap = new Map<number, SlotSummary>();
    tokens.forEach((token, idx) => {
      const stateStr = states[idx];
      if (stateStr) {
        const state = JSON.parse(stateStr);
        realClientsMap.set(start + idx + offset, {
          seq: state.seq,
          position: start + idx + offset,
          state: state.checked ? 'checked' : 'waiting'
        });
      }
    });

    for (let i = fromPos; i <= toPos; i++) {
      if (i < 0 || i >= total) continue;

      const realClient = realClientsMap.get(i);
      if (realClient) {
        summaries.push(realClient);
      } else {
        // Mock phantom slot
        summaries.push({
          seq: -1000 - i,
          position: i,
          state: 'waiting',
        });
      }
    }
    return summaries;
  }

  async size(): Promise<number> {
    return await this.redis.zcard(this.QUEUE_KEY);
  }

  // Get all real clients (for broadcasting/position updates)
  async getAllRealClients(): Promise<{token: string, seq: number}[]> {
    const raw = await this.redis.zrange(this.QUEUE_KEY, 0, -1, 'WITHSCORES');
    const clients: {token: string, seq: number}[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      clients.push({ token: raw[i], seq: parseInt(raw[i+1]) });
    }
    return clients;
  }
}
