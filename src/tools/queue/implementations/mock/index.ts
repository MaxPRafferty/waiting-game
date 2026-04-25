import type { IQueue, QueueClient } from '../../interface.js';
import type { SlotSummary } from '../../../../types.js';

export class MockQueue implements IQueue {
  private clients = new Map<string, QueueClient>();
  private seqCounter = 0;

  async add(token: string): Promise<QueueClient> {
    const now = Date.now();
    const client: QueueClient = {
      seq: this.seqCounter++,
      token,
      checked: false,
      joined_at: now,
      last_ping: now,
      is_visible: true,
    };
    this.clients.set(token, client);
    return client;
  }

  async remove(token: string): Promise<QueueClient | null> {
    const client = this.clients.get(token);
    if (client) {
      this.clients.delete(token);
      return client;
    }
    return null;
  }

  async get(token: string): Promise<QueueClient | null> {
    return this.clients.get(token) || null;
  }

  async getPosition(token: string): Promise<number> {
    const client = this.clients.get(token);
    if (!client) return -1;
    let count = 0;
    for (const c of this.clients.values()) {
      if (c.seq < client.seq) count++;
    }
    return count;
  }

  async getWaitingPosition(token: string): Promise<number> {
    const client = this.clients.get(token);
    if (!client || client.checked) return -1;
    let count = 0;
    for (const c of this.clients.values()) {
      if (c.seq < client.seq && !c.checked) count++;
    }
    return count;
  }

  async isEligible(token: string): Promise<boolean> {
    const pos = await this.getWaitingPosition(token);
    return pos === 0;
  }

  async check(token: string): Promise<{ success: boolean; seq: number; position: number; duration_ms: number }> {
    const client = this.clients.get(token);
    if (!client || client.checked || !(await this.isEligible(token))) {
      return { success: false, seq: -1, position: -1, duration_ms: 0 };
    }

    client.checked = true;
    return {
      success: true,
      seq: client.seq,
      position: await this.getPosition(token),
      duration_ms: Date.now() - client.joined_at,
    };
  }

  async getRange(fromPos: number, toPos: number, offset: number, total: number): Promise<SlotSummary[]> {
    const summaries: SlotSummary[] = [];
    const allClients = Array.from(this.clients.values()).sort((a, b) => a.seq - b.seq);

    for (let i = fromPos; i <= toPos; i++) {
      if (i < 0 || i >= total) continue;

      const realIdx = i - offset;
      const realClient = (realIdx >= 0 && realIdx < allClients.length) ? allClients[realIdx] : null;

      if (realClient) {
        summaries.push({
          seq: realClient.seq,
          position: i,
          state: realClient.checked ? 'checked' : 'waiting',
        });
      } else {
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
    return this.clients.size;
  }

  async getAllRealClients(): Promise<{ token: string; seq: number }[]> {
    return Array.from(this.clients.values())
      .sort((a, b) => a.seq - b.seq)
      .map(c => ({ token: c.token, seq: c.seq }));
  }

  async touch(token: string): Promise<void> {
    const c = this.clients.get(token);
    if (c) c.last_ping = Date.now();
  }

  async setVisibility(token: string, visible: boolean): Promise<void> {
    const c = this.clients.get(token);
    if (c) {
      c.is_visible = visible;
      if (visible) c.last_ping = Date.now();
    }
  }

  async evictStale(thresholdMs: number): Promise<QueueClient[]> {
    const now = Date.now();
    const evicted: QueueClient[] = [];
    for (const [token, client] of this.clients) {
      if (!client.checked && client.is_visible && now - client.last_ping > thresholdMs) {
        this.clients.delete(token);
        evicted.push(client);
      }
    }
    return evicted;
  }

  async getPositionSnapshot(): Promise<Array<{token: string, absolutePosition: number, waitingPosition: number}>> {
    const sorted = Array.from(this.clients.values()).sort((a, b) => a.seq - b.seq);
    let waitIdx = 0;
    return sorted.map((c, i) => ({
      token: c.token,
      absolutePosition: i,
      waitingPosition: c.checked ? -1 : waitIdx++,
    }));
  }
}
