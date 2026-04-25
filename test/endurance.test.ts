import { describe, it, expect, beforeEach } from 'vitest';
import { MockEndurance } from '../src/tools/endurance/implementations/mock/index.js';

describe('MockEndurance', () => {
  let endurance: MockEndurance;

  beforeEach(() => {
    endurance = new MockEndurance();
  });

  it('starts empty', async () => {
    const top = await endurance.getTop(10);
    expect(top).toEqual([]);
  });

  it('adds and retrieves entries', async () => {
    await endurance.addEntry(1, 5000);
    await endurance.addEntry(2, 10000);
    const top = await endurance.getTop(10);
    expect(top).toHaveLength(2);
  });

  it('sorts by duration_ms descending', async () => {
    await endurance.addEntry(1, 5000);
    await endurance.addEntry(2, 15000);
    await endurance.addEntry(3, 10000);
    const top = await endurance.getTop(10);
    expect(top[0].seq).toBe(2);
    expect(top[0].duration_ms).toBe(15000);
    expect(top[1].seq).toBe(3);
    expect(top[2].seq).toBe(1);
  });

  it('respects limit', async () => {
    for (let i = 0; i < 20; i++) {
      await endurance.addEntry(i, i * 1000);
    }
    const top = await endurance.getTop(5);
    expect(top).toHaveLength(5);
    expect(top[0].duration_ms).toBe(19000);
  });

  it('includes timestamp', async () => {
    await endurance.addEntry(42, 7000);
    const top = await endurance.getTop(1);
    expect(top[0].timestamp).toBeGreaterThan(0);
  });
});
