import type { WebSocket } from 'ws';
import type { SlotState, SlotSummary } from './types.js';

export interface Client {
  seq: number;
  token: string;
  ws: WebSocket;
  checked: boolean;
  joined_at: number;
  last_ping: number;
}

export class QueueStore {
  private clients = new Map<string, Client>();
  private seqCounter = 0;

  add(token: string, ws: WebSocket): Client {
    const client: Client = {
      seq: this.seqCounter++,
      token,
      ws,
      checked: false,
      joined_at: Date.now(),
      last_ping: Date.now(),
    };
    this.clients.set(token, client);
    return client;
  }

  remove(token: string): Client | undefined {
    const client = this.clients.get(token);
    if (client) this.clients.delete(token);
    return client;
  }

  touch(token: string): void {
    const c = this.clients.get(token);
    if (c) c.last_ping = Date.now();
  }

  has(token: string): boolean {
    return this.clients.has(token);
  }

  get(token: string): Client | undefined {
    return this.clients.get(token);
  }

  // Count of alive clients with seq < this client's seq
  getPosition(token: string): number {
    const client = this.clients.get(token);
    if (!client) return -1;
    let count = 0;
    for (const c of this.clients.values()) {
      if (c.seq < client.seq) count++;
    }
    return count;
  }

  getPositionBySeq(seq: number): number {
    let count = 0;
    for (const c of this.clients.values()) {
      if (c.seq < seq) count++;
    }
    return count;
  }

  // Eligible = no alive unchecked clients with seq less than this client's
  isEligible(token: string): boolean {
    const client = this.clients.get(token);
    if (!client || client.checked) return false;
    for (const c of this.clients.values()) {
      if (c.seq < client.seq && !c.checked) return false;
    }
    return true;
  }

  check(token: string): { success: boolean; seq: number; position: number; duration_ms: number } {
    const client = this.clients.get(token);
    if (!client)          return { success: false, seq: -1, position: -1, duration_ms: 0 };
    if (client.checked)   return { success: false, seq: -1, position: -1, duration_ms: 0 };
    if (!this.isEligible(token)) return { success: false, seq: -1, position: -1, duration_ms: 0 };

    client.checked = true;
    return {
      success: true,
      seq: client.seq,
      position: this.getPosition(token),
      duration_ms: Date.now() - client.joined_at,
    };
  }

  // All clients sorted by seq ascending
  all(): Client[] {
    return [...this.clients.values()].sort((a, b) => a.seq - b.seq);
  }

  // All clients as SlotSummary for range_state
  allSummaries(): SlotSummary[] {
    return this.all().map((c, idx) => ({
      seq: c.seq,
      position: idx,
      state: c.checked ? 'checked' : 'waiting' as SlotState,
    }));
  }

  // Get a range of slots, filling gaps with 'phantom' data if needed for the mock
  getRange(fromPos: number, toPos: number, offset: number, total: number): SlotSummary[] {
    const summaries: SlotSummary[] = [];
    const allClients = this.all();

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
        // Mock phantom slot
        summaries.push({
          seq: -1000 - i, // Fixed negative seq for phantoms
          position: i,
          state: 'waiting',
        });
      }
    }
    return summaries;
  }

  // Clients with seq > given seq (behind a departed/checked slot)
  clientsBehind(seq: number): Client[] {
    return [...this.clients.values()].filter(c => c.seq > seq);
  }

  // Remove connections that haven't pinged within threshold
  evictStale(thresholdMs: number): Client[] {
    const now = Date.now();
    const evicted: Client[] = [];
    for (const [token, client] of this.clients) {
      if (!client.checked && now - client.last_ping > thresholdMs) {
        this.clients.delete(token);
        evicted.push(client);
      }
    }
    return evicted;
  }

  size(): number {
    return this.clients.size;
  }
}
