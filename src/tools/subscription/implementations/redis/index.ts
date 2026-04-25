import Redis from 'ioredis';
import type { ISubscription, SubscriptionCallback } from '../../interface.js';

interface ConnectionEntry {
  buckets: Set<number>;
  callback: SubscriptionCallback;
}

export class RedisSubscription implements ISubscription {
  private bucketSize = 1000;
  private pub: Redis;
  private sub: Redis;
  private bucketToConnections = new Map<number, Set<string>>();
  private connections = new Map<string, ConnectionEntry>();
  private subscribedChannels = new Set<string>();

  constructor(redisUrl?: string) {
    this.pub = redisUrl ? new Redis(redisUrl) : new Redis();
    this.sub = redisUrl ? new Redis(redisUrl) : new Redis();

    this.sub.on('message', (channel: string, message: string) => {
      const bucketId = this.channelToBucket(channel);
      if (bucketId === null) return;

      const connectionIds = this.bucketToConnections.get(bucketId);
      if (!connectionIds) return;

      for (const connId of connectionIds) {
        const entry = this.connections.get(connId);
        if (entry) {
          entry.callback(message);
        }
      }
    });
  }

  private channelName(bucketId: number): string {
    return `wg:sub:bucket:${bucketId}`;
  }

  private channelToBucket(channel: string): number | null {
    const match = channel.match(/^wg:sub:bucket:(\d+)$/);
    return match ? parseInt(match[1]) : null;
  }

  async subscribe(connectionId: string, minSeq: number, maxSeq: number, onMessage: SubscriptionCallback): Promise<void> {
    await this.unsubscribe(connectionId);

    const startBucket = Math.floor(minSeq / this.bucketSize);
    const endBucket = Math.floor(maxSeq / this.bucketSize);
    const buckets = new Set<number>();

    for (let b = startBucket; b <= endBucket; b++) {
      if (!this.bucketToConnections.has(b)) {
        this.bucketToConnections.set(b, new Set());
      }
      this.bucketToConnections.get(b)!.add(connectionId);
      buckets.add(b);

      const channel = this.channelName(b);
      if (!this.subscribedChannels.has(channel)) {
        this.subscribedChannels.add(channel);
        await this.sub.subscribe(channel);
      }
    }

    this.connections.set(connectionId, { buckets, callback: onMessage });
  }

  async unsubscribe(connectionId: string): Promise<void> {
    const entry = this.connections.get(connectionId);
    if (!entry) return;

    for (const b of entry.buckets) {
      const bucket = this.bucketToConnections.get(b);
      if (bucket) {
        bucket.delete(connectionId);
        if (bucket.size === 0) {
          this.bucketToConnections.delete(b);
          const channel = this.channelName(b);
          this.subscribedChannels.delete(channel);
          await this.sub.unsubscribe(channel);
        }
      }
    }

    this.connections.delete(connectionId);
  }

  async publish(seq: number, message: string): Promise<void> {
    const bucketId = Math.floor(seq / this.bucketSize);
    const channel = this.channelName(bucketId);
    await this.pub.publish(channel, message);
  }
}
