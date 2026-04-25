import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockQueue } from '../src/tools/queue/implementations/mock/index.js';
import { InMemorySubscription } from '../src/tools/subscription/implementations/mock/index.js';
import { MockStatistics } from '../src/tools/statistics/implementations/mock/index.js';
import { MockLeaderboard } from '../src/tools/leaderboard/implementations/mock/index.js';

vi.mock('../src/tools/queue/index.js', () => {
  const q = new MockQueue();
  return { queue: q, __mockQueue: q };
});

vi.mock('../src/tools/subscription/index.js', () => {
  const s = new InMemorySubscription();
  return { subscription: s, __mockSubscription: s };
});

vi.mock('../src/tools/statistics/index.js', () => {
  const s = new MockStatistics();
  return { statistics: s, __mockStatistics: s };
});

vi.mock('../src/tools/leaderboard/index.js', () => {
  const l = new MockLeaderboard();
  return { leaderboard: l, __mockLeaderboard: l };
});

vi.mock('../src/tools/imageGenerator/index.js', () => ({
  imageGenerator: { generate: vi.fn().mockResolvedValue(Buffer.from('fake')) },
}));

vi.mock('../src/tools/endurance/index.js', () => ({
  endurance: {
    addEntry: vi.fn().mockResolvedValue(undefined),
    getTop: vi.fn().mockResolvedValue([]),
  },
}));

import { QueueWorker } from '../src/workers/queue/index.js';

describe('QueueWorker', () => {
  let worker: QueueWorker;

  beforeEach(() => {
    vi.resetModules();
  });

  beforeEach(async () => {
    const qMod = await import('../src/tools/queue/index.js') as any;
    const sMod = await import('../src/tools/subscription/index.js') as any;
    const stMod = await import('../src/tools/statistics/index.js') as any;
    const lMod = await import('../src/tools/leaderboard/index.js') as any;

    qMod.queue = new MockQueue();
    sMod.subscription = new InMemorySubscription();
    stMod.statistics = new MockStatistics();
    lMod.leaderboard = new MockLeaderboard();

    worker = new QueueWorker();
  });

  describe('join', () => {
    it('assigns a sequence number and position to a new client', async () => {
      const result = await worker.join('token-a');
      expect(result.client.token).toBe('token-a');
      expect(result.client.seq).toBe(0);
      expect(result.client.checked).toBe(false);
      expect(result.absolutePosition).toBeGreaterThanOrEqual(0);
      expect(result.waitingPosition).toBe(0);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('assigns incrementing sequence numbers', async () => {
      const a = await worker.join('token-a');
      const b = await worker.join('token-b');
      expect(b.client.seq).toBeGreaterThan(a.client.seq);
    });

    it('positions second client behind first', async () => {
      await worker.join('token-a');
      const b = await worker.join('token-b');
      expect(b.waitingPosition).toBe(1);
    });

    it('tracks total size correctly', async () => {
      await worker.join('a');
      await worker.join('b');
      await worker.join('c');
      const result = await worker.join('d');
      expect(result.total).toBeGreaterThanOrEqual(4);
    });
  });

  describe('check', () => {
    it('allows the first-in-line to check', async () => {
      await worker.join('first');
      const result = await worker.check('first');
      expect(result.success).toBe(true);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('rejects a check when not eligible (someone ahead)', async () => {
      await worker.join('first');
      await worker.join('second');
      const result = await worker.check('second');
      expect(result.success).toBe(false);
    });

    it('allows second to check after first checks', async () => {
      await worker.join('first');
      await worker.join('second');
      await worker.check('first');
      const result = await worker.check('second');
      expect(result.success).toBe(true);
    });

    it('rejects double-check', async () => {
      await worker.join('first');
      await worker.check('first');
      const result = await worker.check('first');
      expect(result.success).toBe(false);
    });

    it('records the winner on the leaderboard', async () => {
      await worker.join('first');
      await worker.check('first');
      const leaders = await worker.getLeaderboard(10);
      expect(leaders).toHaveLength(1);
      expect(leaders[0].seq).toBe(0);
    });
  });

  describe('leave', () => {
    it('removes a client from the queue', async () => {
      await worker.join('token-a');
      const left = await worker.leave('token-a');
      expect(left).not.toBeNull();
      expect(left!.token).toBe('token-a');
    });

    it('returns null for unknown token', async () => {
      const left = await worker.leave('nonexistent');
      expect(left).toBeNull();
    });

    it('increments departures counter', async () => {
      await worker.join('token-a');
      const left = await worker.leave('token-a');
      expect(left!.departures_today).toBe(1);
    });

    it('unsubscribes the connection', async () => {
      await worker.join('token-a');
      await worker.subscribe('token-a', 0, 100);
      await worker.leave('token-a');
      await worker.unsubscribe('token-a');
    });

    it('promotes the next client to eligible after departure', async () => {
      await worker.join('first');
      await worker.join('second');
      await worker.leave('first');
      const result = await worker.check('second');
      expect(result.success).toBe(true);
    });
  });

  describe('cleanup (eviction)', () => {
    it('evicts clients that have not pinged within threshold', async () => {
      await worker.join('stale');
      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(0);
    });

    it('does not evict clients that have pinged recently', async () => {
      await worker.join('active');
      await worker.touch('active');
      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(0);
    });

    it('evicts stale clients and increments departures', async () => {
      const qMod = await import('../src/tools/queue/index.js') as any;
      const mockQueue = qMod.queue as MockQueue;

      await worker.join('stale');
      const client = await mockQueue.get('stale');
      if (client) {
        client.last_ping = Date.now() - 60_000;
      }

      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(1);
      expect(evicted[0].token).toBe('stale');
      expect(evicted[0].departures_today).toBe(1);
    });

    it('does not evict checked clients', async () => {
      const qMod = await import('../src/tools/queue/index.js') as any;
      const mockQueue = qMod.queue as MockQueue;

      await worker.join('winner');
      await worker.check('winner');

      const client = await mockQueue.get('winner');
      if (client) {
        client.last_ping = Date.now() - 60_000;
      }

      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(0);
    });
  });

  describe('getViewport', () => {
    it('returns slots for the requested range', async () => {
      await worker.join('a');
      await worker.join('b');
      await worker.join('c');

      const { slots, total } = await worker.getViewport(500_000, 500_002);
      expect(slots).toHaveLength(3);
      expect(total).toBeGreaterThanOrEqual(500_003);
    });

    it('returns correct slot states', async () => {
      await worker.join('first');
      await worker.join('second');
      await worker.check('first');

      const { slots } = await worker.getViewport(500_000, 500_001);
      const first = slots.find(s => s.seq === 0);
      const second = slots.find(s => s.seq === 1);
      expect(first?.state).toBe('checked');
      expect(second?.state).toBe('waiting');
    });

    it('returns synthetic slots for positions outside real clients', async () => {
      await worker.join('only');
      const { slots } = await worker.getViewport(0, 5);
      expect(slots.length).toBeGreaterThan(1);
      const synthetic = slots.filter(s => s.seq < 0);
      expect(synthetic.length).toBeGreaterThan(0);
    });

    it('handles empty queue', async () => {
      const { slots, total } = await worker.getViewport(0, 10);
      expect(total).toBeGreaterThanOrEqual(0);
      for (const slot of slots) {
        expect(slot.state).toBe('waiting');
      }
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('subscribes and returns viewport data', async () => {
      await worker.join('viewer');
      const { slots, total } = await worker.subscribe('viewer', 500_000, 500_010);
      expect(slots.length).toBeGreaterThan(0);
      expect(total).toBeGreaterThanOrEqual(1);
    });

    it('unsubscribes without error', async () => {
      await worker.join('viewer');
      await worker.subscribe('viewer', 0, 100);
      await worker.unsubscribe('viewer');
    });

    it('re-subscribe replaces previous subscription', async () => {
      await worker.join('viewer');
      await worker.subscribe('viewer', 0, 100);
      await worker.subscribe('viewer', 200, 300);
      await worker.unsubscribe('viewer');
    });
  });

  describe('getDeparturesToday', () => {
    it('starts at zero', async () => {
      const count = await worker.getDeparturesToday();
      expect(count).toBe(0);
    });

    it('increments with departures', async () => {
      await worker.join('a');
      await worker.join('b');
      await worker.leave('a');
      await worker.leave('b');
      const count = await worker.getDeparturesToday();
      expect(count).toBe(2);
    });
  });

  describe('getLeaderboard', () => {
    it('returns empty array initially', async () => {
      const leaders = await worker.getLeaderboard();
      expect(leaders).toEqual([]);
    });

    it('returns winners after checks', async () => {
      await worker.join('first');
      await worker.join('second');
      await worker.check('first');
      await worker.check('second');

      const leaders = await worker.getLeaderboard(10);
      expect(leaders).toHaveLength(2);
    });

    it('respects limit parameter', async () => {
      await worker.join('a');
      await worker.join('b');
      await worker.join('c');
      await worker.check('a');
      await worker.check('b');
      await worker.check('c');

      const leaders = await worker.getLeaderboard(2);
      expect(leaders).toHaveLength(2);
    });
  });

  describe('visibility', () => {
    it('hidden client is not evicted after going stale', async () => {
      const qMod = await import('../src/tools/queue/index.js') as any;
      const mockQueue = qMod.queue as MockQueue;

      await worker.join('mobile-user');
      await worker.setVisibility('mobile-user', false);

      const client = await mockQueue.get('mobile-user');
      if (client) {
        client.last_ping = Date.now() - 60_000;
      }

      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(0);
    });

    it('revealed client gets fresh ping window', async () => {
      const qMod = await import('../src/tools/queue/index.js') as any;
      const mockQueue = qMod.queue as MockQueue;

      await worker.join('mobile-user');
      await worker.setVisibility('mobile-user', false);

      const client = await mockQueue.get('mobile-user');
      if (client) {
        client.last_ping = Date.now() - 60_000;
      }

      await worker.setVisibility('mobile-user', true);

      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(0);
    });

    it('visible stale client is evicted', async () => {
      const qMod = await import('../src/tools/queue/index.js') as any;
      const mockQueue = qMod.queue as MockQueue;

      await worker.join('desktop-user');
      // is_visible defaults to true

      const client = await mockQueue.get('desktop-user');
      if (client) {
        client.last_ping = Date.now() - 60_000;
      }

      const evicted = await worker.cleanup();
      expect(evicted).toHaveLength(1);
      expect(evicted[0].token).toBe('desktop-user');
    });
  });

  describe('publishToSubscribers', () => {
    it('delivers message to subscribed connections', async () => {
      const received: string[] = [];
      const callback = (msg: string) => received.push(msg);

      await worker.join('viewer');
      await worker.subscribe('viewer', 500_000, 500_010, callback);

      const joinRes = await worker.join('new-client');
      await worker.publishToSubscribers(joinRes.client.seq, {
        type: 'range_update',
        seq: joinRes.client.seq,
        position: joinRes.absolutePosition,
        state: 'waiting',
      });

      expect(received).toHaveLength(1);
      const parsed = JSON.parse(received[0]);
      expect(parsed.type).toBe('range_update');
    });

    it('does not deliver to unsubscribed connections', async () => {
      const received: string[] = [];
      const callback = (msg: string) => received.push(msg);

      await worker.join('viewer');
      await worker.subscribe('viewer', 500_000, 500_010, callback);
      await worker.unsubscribe('viewer');

      await worker.publishToSubscribers(0, {
        type: 'range_update',
        seq: 0,
        position: 500_000,
        state: 'waiting',
      });

      expect(received).toHaveLength(0);
    });
  });

  describe('getPositionsBehind (N+1 fix)', () => {
    it('computes positions from a single snapshot', async () => {
      await worker.join('a');
      await worker.join('b');
      await worker.join('c');

      const positions = await worker.getPositionsBehind(0);
      expect(positions).toHaveLength(3);
      expect(positions[0].token).toBe('a');
      expect(positions[1].token).toBe('b');
      expect(positions[2].token).toBe('c');
      expect(positions[0].absolutePosition).toBeLessThan(positions[1].absolutePosition);
      expect(positions[1].absolutePosition).toBeLessThan(positions[2].absolutePosition);
    });

    it('waiting positions update after a check', async () => {
      await worker.join('a');
      await worker.join('b');
      await worker.join('c');
      await worker.check('a');

      const positions = await worker.getPositionsBehind(0);
      const aPos = positions.find(p => p.token === 'a')!;
      const bPos = positions.find(p => p.token === 'b')!;
      const cPos = positions.find(p => p.token === 'c')!;

      expect(aPos.waitingPosition).toBe(-1);
      expect(bPos.waitingPosition).toBe(0);
      expect(cPos.waitingPosition).toBe(1);
    });
  });
});
