import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySubscription } from '../src/tools/subscription/implementations/mock/index.js';

describe('InMemorySubscription', () => {
  let sub: InMemorySubscription;

  beforeEach(() => {
    sub = new InMemorySubscription();
  });

  describe('subscribe + publish', () => {
    it('delivers messages to subscribers in the matching bucket', async () => {
      const received: string[] = [];
      await sub.subscribe('conn-1', 0, 500, (msg) => received.push(msg));

      await sub.publish(250, '{"type":"test"}');
      expect(received).toEqual(['{"type":"test"}']);
    });

    it('does not deliver to wrong bucket', async () => {
      const received: string[] = [];
      await sub.subscribe('conn-1', 0, 500, (msg) => received.push(msg));

      await sub.publish(5000, '{"type":"test"}');
      expect(received).toEqual([]);
    });

    it('delivers to multiple subscribers in the same bucket', async () => {
      const r1: string[] = [];
      const r2: string[] = [];
      await sub.subscribe('conn-1', 0, 500, (msg) => r1.push(msg));
      await sub.subscribe('conn-2', 100, 900, (msg) => r2.push(msg));

      await sub.publish(250, 'hello');
      expect(r1).toEqual(['hello']);
      expect(r2).toEqual(['hello']);
    });

    it('spans multiple buckets when range crosses boundaries', async () => {
      const received: string[] = [];
      await sub.subscribe('conn-1', 900, 1100, (msg) => received.push(msg));

      await sub.publish(950, 'bucket-0');
      await sub.publish(1050, 'bucket-1');
      expect(received).toEqual(['bucket-0', 'bucket-1']);
    });
  });

  describe('unsubscribe', () => {
    it('stops delivery after unsubscribe', async () => {
      const received: string[] = [];
      await sub.subscribe('conn-1', 0, 500, (msg) => received.push(msg));
      await sub.unsubscribe('conn-1');

      await sub.publish(250, 'should-not-arrive');
      expect(received).toEqual([]);
    });

    it('does not affect other subscribers', async () => {
      const r1: string[] = [];
      const r2: string[] = [];
      await sub.subscribe('conn-1', 0, 500, (msg) => r1.push(msg));
      await sub.subscribe('conn-2', 0, 500, (msg) => r2.push(msg));

      await sub.unsubscribe('conn-1');
      await sub.publish(250, 'hello');

      expect(r1).toEqual([]);
      expect(r2).toEqual(['hello']);
    });

    it('handles double unsubscribe gracefully', async () => {
      await sub.subscribe('conn-1', 0, 500, () => {});
      await sub.unsubscribe('conn-1');
      await sub.unsubscribe('conn-1');
    });
  });

  describe('re-subscribe', () => {
    it('replaces callback on re-subscribe', async () => {
      const r1: string[] = [];
      const r2: string[] = [];
      await sub.subscribe('conn-1', 0, 500, (msg) => r1.push(msg));
      await sub.subscribe('conn-1', 0, 500, (msg) => r2.push(msg));

      await sub.publish(250, 'hello');
      expect(r1).toEqual([]);
      expect(r2).toEqual(['hello']);
    });

    it('cleans up old buckets on range change', async () => {
      const received: string[] = [];
      await sub.subscribe('conn-1', 0, 500, () => {});
      await sub.subscribe('conn-1', 5000, 5500, (msg) => received.push(msg));

      await sub.publish(250, 'old-range');
      await sub.publish(5250, 'new-range');

      expect(received).toEqual(['new-range']);
    });
  });

  describe('iron-rule: far-viewport sees near-front events', () => {
    it('subscriber at seq 50K sees range_update when seq 1001 publishes', async () => {
      const farReceived: string[] = [];
      const nearReceived: string[] = [];

      await sub.subscribe('far-viewer', 50_000, 50_100, (msg) => farReceived.push(msg));
      await sub.subscribe('near-viewer', 1_000, 1_100, (msg) => nearReceived.push(msg));

      const msg = JSON.stringify({ type: 'range_update', seq: 1_001, position: 1_001, state: 'checked' });
      await sub.publish(1_001, msg);

      expect(nearReceived).toHaveLength(1);
      expect(farReceived).toHaveLength(0);

      const farMsg = JSON.stringify({ type: 'range_update', seq: 50_050, position: 50_050, state: 'checked' });
      await sub.publish(50_050, farMsg);
      expect(farReceived).toHaveLength(1);
    });

    it('full iron-rule: far-viewport viewer sees departure event in their range', async () => {
      const farReceived: string[] = [];
      await sub.subscribe('far-viewer', 50_000, 50_100, (msg) => farReceived.push(msg));

      const departureMsg = JSON.stringify({ type: 'left', seq: 50_042, departures_today: 7 });
      await sub.publish(50_042, departureMsg);

      expect(farReceived).toHaveLength(1);
      const parsed = JSON.parse(farReceived[0]);
      expect(parsed.type).toBe('left');
      expect(parsed.seq).toBe(50_042);
    });
  });
});
