export const CHECKBOX_WIDTH_PX = 34;
export const DOM_POOL_SIZE = 120;

export function clampScroll(offset, totalSlots) {
  return Math.max(0, Math.min(totalSlots - 1, offset));
}

export function computeScrollOffset(current, delta, totalSlots, isAbsolute) {
  if (isAbsolute) {
    return clampScroll(delta, totalSlots);
  }
  return clampScroll(current + delta / CHECKBOX_WIDTH_PX, totalSlots);
}

export function computeVisibleRange(scrollOffset, viewportWidth) {
  const visibleCount = Math.ceil(viewportWidth / CHECKBOX_WIDTH_PX) + 10;
  const from = Math.max(0, Math.floor(scrollOffset) - 5);
  const to = from + visibleCount;
  return { from, to };
}

export function shouldResubscribe(newRange, lastRange, threshold = 5) {
  return Math.abs(newRange.from - lastRange.from) > threshold
      || Math.abs(newRange.to - lastRange.to) > threshold;
}

export function computeVisiblePositions(scrollOffset, viewportWidth, totalSlots) {
  const visibleCount = Math.ceil(viewportWidth / CHECKBOX_WIDTH_PX) + 2;
  const startPos = Math.floor(scrollOffset);
  const endPos = startPos + visibleCount;
  const positions = [];
  for (let i = startPos; i <= endPos; i++) {
    if (i >= 0 && i < totalSlots) positions.push(i);
  }
  return positions;
}

export function resolveSlotState(slot, mySeq, myChecked, allSlots) {
  const isMine = slot.seq === mySeq;

  const isEligible = isMine && !myChecked && (() => {
    for (const s of allSlots) {
      if (s.seq >= 0 && s.seq < mySeq && s.state === 'waiting') return false;
    }
    return true;
  })();

  return {
    isMine,
    isEligible: !!isEligible,
    isGhost: slot.state === 'ghost',
    isChecked: slot.state === 'checked',
  };
}

export function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
