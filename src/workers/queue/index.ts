import { queue } from '../../tools/queue/index.js';
import { subscription } from '../../tools/subscription/index.js';
import { statistics } from '../../tools/statistics/index.js';
import { leaderboard } from '../../tools/leaderboard/index.js';
import { imageGenerator } from '../../tools/imageGenerator/index.js';
import { endurance } from '../../tools/endurance/index.js';
import { storage } from '../../tools/storage/index.js';
import type { SubscriptionCallback } from '../../tools/subscription/interface.js';
import type { ServerMessage } from '../../types.js';

export class QueueWorker {
  private MOCK_START_SIZE: number;
  private mockTotal: number;
  private STALE_THRESHOLD_MS = 12_000;
  private mockSeeded = false;
  private static MOCK_SEED_COUNT = 3;

  constructor() {
    this.MOCK_START_SIZE = process.env.DEPENDENCY_MODE === 'LIVE' ? 0 : 500_000;
    this.mockTotal = this.MOCK_START_SIZE;
  }

  private async seedMockQueue() {
    if (this.mockSeeded || process.env.DEPENDENCY_MODE === 'LIVE') return;
    this.mockSeeded = true;
    for (let i = 0; i < QueueWorker.MOCK_SEED_COUNT; i++) {
      await queue.add(`__mock_${i}`);
      await queue.setVisibility(`__mock_${i}`, false);
    }
  }

  async join(token: string) {
    await this.seedMockQueue();
    const client = await queue.add(token);
    const absPos = await queue.getPosition(token);
    const waitPos = await queue.getWaitingPosition(token);

    const size = await queue.size();
    if (this.mockTotal < this.MOCK_START_SIZE + size) {
      this.mockTotal = this.MOCK_START_SIZE + size;
    }

    return {
      client,
      absolutePosition: this.MOCK_START_SIZE + absPos,
      waitingPosition: waitPos,
      total: this.mockTotal
    };
  }

  async leave(token: string) {
    const client = await queue.remove(token);
    if (client) {
      await subscription.unsubscribe(token);
      const departuresToday = await statistics.incrementDepartures();
      return { ...client, departures_today: departuresToday };
    }
    return null;
  }

  async subscribe(connectionId: string, fromPos: number, toPos: number, onMessage?: SubscriptionCallback) {
    const { slots, total } = await this.getViewport(fromPos, toPos);

    let minSeq = Infinity;
    let maxSeq = -Infinity;

    for (const s of slots) {
      if (s.seq < minSeq) minSeq = s.seq;
      if (s.seq > maxSeq) maxSeq = s.seq;
    }

    if (minSeq !== Infinity && maxSeq !== -Infinity) {
      const callback = onMessage ?? (() => {});
      await subscription.subscribe(connectionId, minSeq, maxSeq, callback);
    }

    return { slots, total };
  }

  async unsubscribe(connectionId: string) {
    await subscription.unsubscribe(connectionId);
  }

  async publishToSubscribers(seq: number, msg: ServerMessage) {
    await subscription.publish(seq, JSON.stringify(msg));
  }

  async check(token: string) {
    const result = await queue.check(token);
    if (!result.success) return result;

    const absPos = this.MOCK_START_SIZE + result.position;

    await leaderboard.addWinner(result.seq, absPos, result.duration_ms);
    await endurance.addEntry(result.seq, result.duration_ms);

    return {
      ...result,
      position: absPos
    };
  }

  async getViewport(from: number, to: number) {
    const size = await queue.size();
    const realTotal = this.MOCK_START_SIZE + size;
    if (this.mockTotal < realTotal) this.mockTotal = realTotal;

    const slots = await queue.getRange(from, to, this.MOCK_START_SIZE, this.mockTotal);
    return { slots, total: this.mockTotal };
  }

  async touch(token: string) {
    await queue.touch(token);
  }

  async setVisibility(token: string, visible: boolean) {
    await queue.setVisibility(token, visible);
  }

  async cleanup() {
    const evicted = await queue.evictStale(this.STALE_THRESHOLD_MS);
    const results = [];
    for (const client of evicted) {
      await subscription.unsubscribe(client.token);
      const departuresToday = await statistics.incrementDepartures();
      results.push({ ...client, departures_today: departuresToday });
    }
    return results;
  }

  async getPositionsBehind(_seq: number) {
    const snapshot = await queue.getPositionSnapshot();
    return snapshot
      .filter(s => !s.token.startsWith('__mock_'))
      .map(s => ({
        token: s.token,
        absolutePosition: this.MOCK_START_SIZE + s.absolutePosition,
        waitingPosition: s.waitingPosition,
      }));
  }

  async getDeparturesToday() {
    return await statistics.getDeparturesToday();
  }

  async getLeaderboard(limit = 10) {
    return await leaderboard.getRecentWinners(limit);
  }

  async getEnduranceHall(limit = 10) {
    return await endurance.getTop(limit);
  }

  async generateOgImage(seq: number): Promise<Buffer> {
    return await imageGenerator.generate(seq);
  }

  async nameCheckbox(userId: string, token: string, name: string) {
    const NAMED_COLLECTION = 'named_checkboxes';

    const allNamed = await storage.list(NAMED_COLLECTION);
    for (const nc of allNamed) {
      if (nc.user_id === userId && nc.is_active) {
        await storage.save(NAMED_COLLECTION, nc.id, { ...nc, is_active: false });
      }
    }

    const id = crypto.randomUUID();
    await storage.save(NAMED_COLLECTION, id, {
      id,
      user_id: userId,
      token,
      name,
      is_active: true,
      created_at: new Date().toISOString()
    });
  }

  async getRandomActivity(): Promise<ServerMessage[]> {
    const messages: ServerMessage[] = [];

    if (process.env.DEPENDENCY_MODE === 'LIVE') {
      return messages;
    }

    if (Math.random() < 0.3) {
      const clients = await queue.getAllRealClients();
      const mockClient = clients.find(c => c.token.startsWith('__mock_'));
      if (mockClient) {
        const result = await queue.check(mockClient.token);
        if (result.success) {
          const absPos = this.MOCK_START_SIZE + result.position;
          await leaderboard.addWinner(result.seq, absPos, result.duration_ms);
          await endurance.addEntry(result.seq, result.duration_ms);

          messages.push({
            type: 'winner',
            seq: result.seq,
            duration_ms: result.duration_ms
          });
          messages.push({
            type: 'range_update',
            seq: result.seq,
            position: absPos,
            state: 'checked'
          });
        }
      }
    }

    if (Math.random() < 0.1) {
      const mockPos = Math.floor(Math.random() * this.mockTotal);
      const departuresToday = await statistics.incrementDepartures();
      messages.push({
        type: 'left',
        seq: -1000 - mockPos,
        departures_today: departuresToday
      });
    }

    for (let i = 0; i < 2; i++) {
      if (Math.random() < 0.75) {
        const position = this.mockTotal++;
        messages.push({
          type: 'range_update',
          seq: -2000 - position,
          position: position,
          state: 'waiting'
        });
      }
    }

    return messages;
  }
}

export const queueWorker = new QueueWorker();
