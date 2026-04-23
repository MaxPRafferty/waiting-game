import type { ILeaderboard, WinnerEntry } from '../../interface.js';

export class MockLeaderboard implements ILeaderboard {
  private winners: WinnerEntry[] = [];

  async addWinner(seq: number, position: number, duration_ms: number): Promise<void> {
    this.winners.unshift({
      seq,
      position,
      duration_ms,
      timestamp: Date.now()
    });
    // Keep only last 100 for memory sanity
    if (this.winners.length > 100) {
      this.winners.pop();
    }
  }

  async getRecentWinners(limit: number): Promise<WinnerEntry[]> {
    return this.winners.slice(0, limit);
  }
}
