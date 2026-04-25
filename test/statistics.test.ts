import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockStatistics } from '../src/tools/statistics/implementations/mock/index.js';

describe('MockStatistics', () => {
  let stats: MockStatistics;

  beforeEach(() => {
    stats = new MockStatistics();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero departures', async () => {
    expect(await stats.getDeparturesToday()).toBe(0);
  });

  it('increments departures', async () => {
    await stats.incrementDepartures();
    await stats.incrementDepartures();
    expect(await stats.getDeparturesToday()).toBe(2);
  });

  it('returns new count from incrementDepartures', async () => {
    expect(await stats.incrementDepartures()).toBe(1);
    expect(await stats.incrementDepartures()).toBe(2);
    expect(await stats.incrementDepartures()).toBe(3);
  });

  it('resets at UTC midnight (date rollover)', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-24T23:59:58Z');
    vi.setSystemTime(now);

    const s = new MockStatistics();
    await s.incrementDepartures();
    await s.incrementDepartures();
    expect(await s.getDeparturesToday()).toBe(2);

    vi.setSystemTime(new Date('2026-04-25T00:00:01Z'));

    expect(await s.getDeparturesToday()).toBe(0);
    expect(await s.incrementDepartures()).toBe(1);
  });
});
