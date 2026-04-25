# Virtual Scroll

The checkbox broadcast uses a fixed DOM pool to render an arbitrarily long line of slots.

## How It Works

- **DOM pool:** 120 `<div class="slot">` elements are created at boot. No elements are added or removed during runtime — they are repositioned and rebound on each render.
- **Scroll offset:** A logical `scrollOffset` (in slot units) determines which segment of the line is visible. Wheel events increment the offset by `deltaY / CHECKBOX_WIDTH_PX`.
- **Render:** On each frame, `computeVisiblePositions` determines which slot indices fall in the viewport. The DOM pool is recycled to display them at the correct `left` offset.
- **Viewport subscription:** When the visible range drifts more than 5 slots from the last subscribed range, the client sends a `viewport_subscribe` WS message to receive live updates for the new region.

## Constants

| Name | Value | Location |
|------|-------|----------|
| `CHECKBOX_WIDTH_PX` | 34px | `client/virtual-scroll.js` (canonical), `client/index.html` (inline copy as `SLOT_WIDTH`) |
| `DOM_POOL_SIZE` | 120 | Both files |

## Invariants

1. The DOM pool never exceeds 120 nodes. No elements are created after init.
2. `scrollOffset` is always clamped to `[0, totalSlots - 1]`.
3. Viewport resubscription only fires when the range shifts by more than 5 slots (prevents server spam during smooth scroll).
4. Synthetic (non-real) slots use negative seq numbers (`seq < 0`) and are excluded from eligibility checks.
5. The system must render correctly at seq 1,000,000 — positions and states must match injected `range_state` data.

## Manual Smoke Tests

1. **Two-tab mechanic:** Open two tabs. Tab 1 checks → Tab 2 sees the update and becomes eligible.
2. **Rapid wheel scroll (10s):** Hold wheel and scroll aggressively. DOM pool count stays at 120 (inspect Elements panel). No visual glitches or orphaned nodes.
3. **Window resize mid-scroll:** While scrolled to a deep position, resize the window. Slots reflow, no dropped slots, scrollbar scale adjusts.
