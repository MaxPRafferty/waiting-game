import type { IStatistics } from '../../interface.js';

export class MockStatistics implements IStatistics {
  private departures = 0;
  private lastReset = new Date().toISOString().split('T')[0];

  private checkReset() {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastReset !== today) {
      this.departures = 0;
      this.lastReset = today;
    }
  }

  async incrementDepartures(): Promise<number> {
    this.checkReset();
    this.departures++;
    return this.departures;
  }

  async getDeparturesToday(): Promise<number> {
    this.checkReset();
    return this.departures;
  }
}
