import type { IEndurance, EnduranceEntry } from '../../interface.js';

export class MockEndurance implements IEndurance {
  private entries: EnduranceEntry[] = [];

  async addEntry(seq: number, duration_ms: number): Promise<void> {
    this.entries.push({ seq, duration_ms, timestamp: Date.now() });
    this.entries.sort((a, b) => b.duration_ms - a.duration_ms);
    if (this.entries.length > 100) this.entries.pop();
  }

  async getTop(limit: number): Promise<EnduranceEntry[]> {
    return this.entries.slice(0, limit);
  }
}
