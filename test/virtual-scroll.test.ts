import { describe, it, expect } from 'vitest';
import {
  CHECKBOX_WIDTH_PX,
  clampScroll,
  computeScrollOffset,
  computeVisibleRange,
  shouldResubscribe,
  computeVisiblePositions,
  resolveSlotState,
  getOrdinal,
} from '../client/virtual-scroll.js';

describe('virtual-scroll', () => {
  describe('CHECKBOX_WIDTH_PX', () => {
    it('is 34', () => {
      expect(CHECKBOX_WIDTH_PX).toBe(34);
    });
  });

  describe('clampScroll', () => {
    it('clamps to 0 when negative', () => {
      expect(clampScroll(-10, 1000)).toBe(0);
    });

    it('clamps to max when exceeding total', () => {
      expect(clampScroll(2000, 1000)).toBe(999);
    });

    it('passes through valid values', () => {
      expect(clampScroll(500, 1000)).toBe(500);
    });

    it('clamps at 0 for zero totalSlots', () => {
      expect(clampScroll(5, 0)).toBe(0);
    });

    it('handles totalSlots of 1', () => {
      expect(clampScroll(0, 1)).toBe(0);
      expect(clampScroll(1, 1)).toBe(0);
    });
  });

  describe('computeScrollOffset', () => {
    const total = 100_000;

    it('absolute mode sets position directly', () => {
      expect(computeScrollOffset(500, 1000, total, true)).toBe(1000);
    });

    it('absolute mode clamps to 0', () => {
      expect(computeScrollOffset(500, -100, total, true)).toBe(0);
    });

    it('absolute mode clamps to max', () => {
      expect(computeScrollOffset(500, total + 100, total, true)).toBe(total - 1);
    });

    it('delta mode adds scaled delta', () => {
      const result = computeScrollOffset(100, CHECKBOX_WIDTH_PX * 10, total, false);
      expect(result).toBe(110);
    });

    it('delta mode clamps result to 0', () => {
      const result = computeScrollOffset(5, -CHECKBOX_WIDTH_PX * 100, total, false);
      expect(result).toBe(0);
    });

    it('delta mode clamps result to max', () => {
      const result = computeScrollOffset(total - 5, CHECKBOX_WIDTH_PX * 100, total, false);
      expect(result).toBe(total - 1);
    });

    it('zero delta returns current position', () => {
      expect(computeScrollOffset(42, 0, total, false)).toBe(42);
    });

    it('handles negative delta', () => {
      const result = computeScrollOffset(100, -CHECKBOX_WIDTH_PX * 5, total, false);
      expect(result).toBe(95);
    });
  });

  describe('computeVisibleRange', () => {
    it('returns from 5 slots before scrollOffset', () => {
      const { from } = computeVisibleRange(100, 1000);
      expect(from).toBe(95);
    });

    it('clamps from to 0 at start', () => {
      const { from } = computeVisibleRange(2, 1000);
      expect(from).toBe(0);
    });

    it('to extends beyond visible count', () => {
      const { from, to } = computeVisibleRange(100, 340);
      const visibleCount = Math.ceil(340 / CHECKBOX_WIDTH_PX) + 10;
      expect(to).toBe(from + visibleCount);
    });
  });

  describe('shouldResubscribe', () => {
    it('returns false when ranges are close', () => {
      expect(shouldResubscribe({ from: 100, to: 200 }, { from: 103, to: 203 })).toBe(false);
    });

    it('returns true when from differs by more than threshold', () => {
      expect(shouldResubscribe({ from: 100, to: 200 }, { from: 110, to: 210 })).toBe(true);
    });

    it('returns true when to differs by more than threshold', () => {
      expect(shouldResubscribe({ from: 100, to: 200 }, { from: 100, to: 210 })).toBe(true);
    });

    it('returns false for identical ranges', () => {
      expect(shouldResubscribe({ from: 50, to: 150 }, { from: 50, to: 150 })).toBe(false);
    });

    it('respects custom threshold', () => {
      expect(shouldResubscribe({ from: 100, to: 200 }, { from: 108, to: 208 }, 10)).toBe(false);
      expect(shouldResubscribe({ from: 100, to: 200 }, { from: 112, to: 212 }, 10)).toBe(true);
    });
  });

  describe('computeVisiblePositions', () => {
    it('returns positions within viewport', () => {
      const positions = computeVisiblePositions(0, 340, 1000);
      expect(positions.length).toBeGreaterThan(0);
      expect(positions[0]).toBe(0);
    });

    it('excludes positions beyond totalSlots', () => {
      const positions = computeVisiblePositions(995, 340, 1000);
      for (const p of positions) {
        expect(p).toBeLessThan(1000);
        expect(p).toBeGreaterThanOrEqual(0);
      }
    });

    it('excludes negative positions', () => {
      const positions = computeVisiblePositions(0, 340, 1000);
      for (const p of positions) {
        expect(p).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles empty queue', () => {
      const positions = computeVisiblePositions(0, 340, 0);
      expect(positions).toEqual([]);
    });

    it('correctness at seq 1,000,000', () => {
      const total = 1_500_000;
      const offset = 1_000_000;
      const vpWidth = 1200;
      const positions = computeVisiblePositions(offset, vpWidth, total);

      expect(positions.length).toBeGreaterThan(0);
      const visibleCount = Math.ceil(vpWidth / CHECKBOX_WIDTH_PX) + 2;
      expect(positions.length).toBeLessThanOrEqual(visibleCount + 1);

      for (const p of positions) {
        expect(p).toBeGreaterThanOrEqual(offset);
        expect(p).toBeLessThan(total);
      }

      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBe(positions[i - 1] + 1);
      }
    });
  });

  describe('resolveSlotState', () => {
    const allSlots = [
      { seq: 0, position: 500000, state: 'checked' },
      { seq: 1, position: 500001, state: 'waiting' },
      { seq: 2, position: 500002, state: 'waiting' },
    ];

    it('marks mine correctly', () => {
      const result = resolveSlotState(allSlots[1], 1, false, allSlots);
      expect(result.isMine).toBe(true);
    });

    it('marks not-mine correctly', () => {
      const result = resolveSlotState(allSlots[0], 1, false, allSlots);
      expect(result.isMine).toBe(false);
    });

    it('eligible when all ahead are checked', () => {
      const result = resolveSlotState(allSlots[1], 1, false, allSlots);
      expect(result.isEligible).toBe(true);
    });

    it('not eligible when someone ahead is waiting', () => {
      const result = resolveSlotState(allSlots[2], 2, false, allSlots);
      expect(result.isEligible).toBe(false);
    });

    it('not eligible when already checked', () => {
      const result = resolveSlotState(allSlots[1], 1, true, allSlots);
      expect(result.isEligible).toBe(false);
    });

    it('detects ghost state', () => {
      const ghost = { seq: 5, position: 500005, state: 'ghost' };
      const result = resolveSlotState(ghost, 1, false, []);
      expect(result.isGhost).toBe(true);
    });

    it('detects checked state', () => {
      const result = resolveSlotState(allSlots[0], 1, false, allSlots);
      expect(result.isChecked).toBe(true);
    });

    it('ignores synthetic negative-seq slots for eligibility', () => {
      const slotsWithSynthetic = [
        { seq: -1042, position: 42, state: 'waiting' },
        { seq: 5, position: 500005, state: 'waiting' },
      ];
      const result = resolveSlotState(slotsWithSynthetic[1], 5, false, slotsWithSynthetic);
      expect(result.isEligible).toBe(true);
    });
  });

  describe('getOrdinal', () => {
    it('handles 1st, 2nd, 3rd', () => {
      expect(getOrdinal(1)).toBe('1st');
      expect(getOrdinal(2)).toBe('2nd');
      expect(getOrdinal(3)).toBe('3rd');
    });

    it('handles 4th-10th', () => {
      expect(getOrdinal(4)).toBe('4th');
      expect(getOrdinal(10)).toBe('10th');
    });

    it('handles teens (11th, 12th, 13th)', () => {
      expect(getOrdinal(11)).toBe('11th');
      expect(getOrdinal(12)).toBe('12th');
      expect(getOrdinal(13)).toBe('13th');
    });

    it('handles 21st, 22nd, 23rd', () => {
      expect(getOrdinal(21)).toBe('21st');
      expect(getOrdinal(22)).toBe('22nd');
      expect(getOrdinal(23)).toBe('23rd');
    });

    it('handles 111th, 112th, 113th (century teens)', () => {
      expect(getOrdinal(111)).toBe('111th');
      expect(getOrdinal(112)).toBe('112th');
      expect(getOrdinal(113)).toBe('113th');
    });

    it('handles 1,000,001', () => {
      expect(getOrdinal(1000001)).toBe('1000001st');
    });
  });

  describe('ghost fade alignment', () => {
    it('ghost state resolves correctly for departed slots', () => {
      const ghost = { seq: 42, position: 500042, state: 'ghost' };
      const result = resolveSlotState(ghost, 100, false, [ghost]);
      expect(result.isGhost).toBe(true);
      expect(result.isChecked).toBe(false);
      expect(result.isMine).toBe(false);
    });
  });

  describe('correctness at seq 1,000,000', () => {
    it('rendered slot states match injected range_state', () => {
      const baseSeq = 1_000_000;
      const basePosition = 1_000_000;
      const totalSlots = 1_500_000;
      const vpWidth = 1200;

      const injectedSlots = [];
      for (let i = 0; i < 40; i++) {
        injectedSlots.push({
          seq: baseSeq + i,
          position: basePosition + i,
          state: i < 10 ? 'checked' : 'waiting',
        });
      }

      const positions = computeVisiblePositions(basePosition, vpWidth, totalSlots);

      for (const pos of positions) {
        const slot = injectedSlots.find(s => s.position === pos);
        if (slot) {
          const state = resolveSlotState(slot, baseSeq + 15, false, injectedSlots);

          if (slot.state === 'checked') {
            expect(state.isChecked).toBe(true);
          }

          if (slot.seq === baseSeq + 15) {
            expect(state.isMine).toBe(true);
          }

          if (slot.seq === baseSeq + 10) {
            const eligibleState = resolveSlotState(slot, baseSeq + 10, false, injectedSlots);
            expect(eligibleState.isEligible).toBe(true);
          }
        }
      }
    });
  });
});
