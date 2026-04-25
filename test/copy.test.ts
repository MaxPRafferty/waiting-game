import { describe, it, expect } from 'vitest';
import { getCopy } from '../client/copy.js';

describe('copy cycling', () => {
  it('returns a string for each event type', () => {
    expect(getCopy('winner')).toBeTruthy();
    expect(getCopy('departure')).toBeTruthy();
    expect(getCopy('eligible')).toBeTruthy();
  });

  it('returns empty string for unknown event type', () => {
    expect(getCopy('nonexistent')).toBe('');
  });

  it('consecutive calls for same event produce different strings', () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(getCopy('winner'));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('never repeats the same string back-to-back', () => {
    let prev = '';
    for (let i = 0; i < 50; i++) {
      const current = getCopy('winner');
      if (i > 0) {
        expect(current).not.toBe(prev);
      }
      prev = current;
    }
  });

  it('has at least 5 phrasings per event type', () => {
    const winnerPhrases = new Set<string>();
    const departurePhrases = new Set<string>();
    const eligiblePhrases = new Set<string>();

    for (let i = 0; i < 100; i++) {
      winnerPhrases.add(getCopy('winner'));
      departurePhrases.add(getCopy('departure'));
      eligiblePhrases.add(getCopy('eligible'));
    }

    expect(winnerPhrases.size).toBeGreaterThanOrEqual(5);
    expect(departurePhrases.size).toBeGreaterThanOrEqual(5);
    expect(eligiblePhrases.size).toBeGreaterThanOrEqual(5);
  });
});
