import { queue } from '../../tools/queue/index.js';
import type { ServerMessage } from '../../types.js';

export class QueueWorker {
  private MOCK_START_SIZE = 500_000;
  private mockTotal = 500_000;
  private STALE_THRESHOLD_MS = 12_000;

  async join(token: string) {
    const client = await queue.add(token);
    const pos = await queue.getPosition(token);
    
    // Ensure mockTotal is at least as large as the real queue + offset
    const size = await queue.size();
    if (this.mockTotal < this.MOCK_START_SIZE + size) {
      this.mockTotal = this.MOCK_START_SIZE + size;
    }
    
    const mockPosition = this.MOCK_START_SIZE + pos;
    
    return {
      client,
      mockPosition,
      total: this.mockTotal
    };
  }

  async leave(token: string) {
    const client = await queue.remove(token);
    return client;
  }

  async check(token: string) {
    const result = await queue.check(token);
    if (!result.success) return result;

    return {
      ...result,
      position: this.MOCK_START_SIZE + result.position
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

  async cleanup() {
    const evicted = await queue.evictStale(this.STALE_THRESHOLD_MS);
    return evicted;
  }

  async getPositionsBehind(_seq: number) {
    const clients = await queue.getAllRealClients();
    const updates = [];
    for (const client of clients) {
      const pos = await queue.getPosition(client.token);
      updates.push({
        token: client.token,
        position: this.MOCK_START_SIZE + pos
      });
    }
    return updates;
  }

  async getRandomActivity(): Promise<ServerMessage[]> {
    const messages: ServerMessage[] = [];
    
    // Mock Winner
    if (Math.random() < 0.2) {
      const mockPos = Math.floor(Math.random() * 50);
      const mockDuration = Math.floor(Math.random() * 3600_000);
      messages.push({ 
        type: 'winner', 
        seq: -1000 - mockPos, 
        position: mockPos, 
        duration_ms: mockDuration 
      });
      messages.push({
        type: 'range_update',
        seq: -1000 - mockPos,
        position: mockPos,
        state: 'checked'
      });
    }

    // Mock Departure
    if (Math.random() < 0.1) {
      const mockPos = Math.floor(Math.random() * this.mockTotal);
      messages.push({ 
        type: 'left', 
        seq: -1000 - mockPos, 
        departures_today: 0 
      });
    }

    // Mock Arrival - Increment mockTotal
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
