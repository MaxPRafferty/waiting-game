import type { ISubscription } from '../../interface.js';

export class InMemorySubscription implements ISubscription {
  private bucketSize = 1000;
  // bucketId -> Set of connectionIds
  private buckets = new Map<number, Set<string>>();
  // connectionId -> Set of bucketIds (for fast unsubscription)
  private connectionToBuckets = new Map<string, Set<number>>();

  async subscribe(connectionId: string, minSeq: number, maxSeq: number): Promise<void> {
    // Clear existing subscriptions for this connection first
    await this.unsubscribe(connectionId);

    const startBucket = Math.floor(minSeq / this.bucketSize);
    const endBucket = Math.floor(maxSeq / this.bucketSize);

    const subBuckets = new Set<number>();

    for (let b = startBucket; b <= endBucket; b++) {
      if (!this.buckets.has(b)) {
        this.buckets.set(b, new Set());
      }
      this.buckets.get(b)!.add(connectionId);
      subBuckets.add(b);
    }

    this.connectionToBuckets.set(connectionId, subBuckets);
  }

  async unsubscribe(connectionId: string): Promise<void> {
    const subBuckets = this.connectionToBuckets.get(connectionId);
    if (!subBuckets) return;

    for (const b of subBuckets) {
      const bucket = this.buckets.get(b);
      if (bucket) {
        bucket.delete(connectionId);
        if (bucket.size === 0) {
          this.buckets.delete(b);
        }
      }
    }

    this.connectionToBuckets.delete(connectionId);
  }

  async getSubscribers(seq: number): Promise<Set<string>> {
    const bucketId = Math.floor(seq / this.bucketSize);
    return this.buckets.get(bucketId) ?? new Set();
  }
}
