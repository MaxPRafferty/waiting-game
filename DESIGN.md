# Design: The Waiting Game

**Status:** Active source of truth — supersedes all prior design docs.
**Last updated:** 2026-04-24 (post `/plan-eng-review`)
**Historic artifacts (preserved, not edited):**
- `DESIGN-ORIGINAL.md` — original weekend plan (`/office-hours`, 2026-04-22). Architecture decisions still in force.
- `GEMINI-DESIGN.md` — intermediate plan expanding Weekend 7 into a large account/social/seasonal feature set. That scope has been cut; this doc supersedes it.

---

## 1. Overview

The Waiting Game is a real-time, anonymous queue rendered as an impossibly-long horizontal strip of checkboxes. You join at the back. You can check your box only when every box ahead of you is either checked or its owner has left. Leaving the tab evicts you immediately and everyone behind shifts forward. Winning earns a global announcement and an entry in the activity feed + endurance hall.

**The product is the number.** "Contestant #47,291" is the screenshot. Everything else — the strip, the ghosting, the feeds, the counter — serves the shareable moment.

## 2. Vision & Tone

Matter-of-fact deadpan applied to sustained absurdity. Reference points: Blaseball's escalating unreality, Welcome to Night Vale's civic-announcement register, the 20th-century endurance contests (Hands on a Hardbody, radio-DJ car giveaways, dance marathons). The interface is indifferent. The contest has always been running. It will continue.

**Copy rules:**
- No internet shorthand ("rage quit" is banned). Public-notice phrasing only.
- Each event type has a cycling pool of exactly **5 phrasings**, loaded from `client/src/copy.ts`, pick at random per event. No string repeats twice in a session.
- Winning and losing carry the same emotional weight — neither celebrated, neither mourned.

Visual system is in `VISUAL_SYSTEM.md` ("Vibrant Indifference") and will be expanded via `/design-consultation`.

## 3. Core Mechanic

1. New connection → assigned an immutable, monotonically increasing `sequence_number` (the canonical queue key **and the public contestant number**).
2. Displayed in-line `position` is **computed**, never stored: `count of active sequence numbers less than yours`. `waiting_position` is the same count restricted to unchecked users.
3. Eligibility to check: you are at rank 0 of the `waiting_queue`.
4. On check: atomic Redis transaction validates eligibility, records the winner in activity feed + endurance hall, broadcasts a `winner` event.
5. On tab close / 12s of missed pings **from a visible tab**: eviction, `left` event broadcast to range subscribers, slot fades client-side over 30s. Hidden tabs pause their ping (see §4.5 Heartbeat).
6. A freshly-connected client always lands at the back. **Reconnects are not honored.** Session token display-only.

### 3.1 Canonical public number (locked, do not re-litigate)

- **`sequence_number`** (sometimes abbreviated `seq`) is the **public, shareable, immutable** number. Screenshots, OG image, winner broadcast, activity feed, endurance hall, tab title — all show `seq`.
- **`position` / `waiting_position`** are **internal eligibility UI**: the strip header during play ("47th in line"), and server-side eligibility checks. Never exposed as the shareable artifact.
- Tab title format: `#47,291 — The Waiting Game` during waiting; `✓ #47,291` after winning.

This split means a player who joins during a quiet launch week still has a meaningful number ("contestant #142") without needing 47K concurrent peers.

## 4. Architecture

Approach B from the original design — **chosen and implemented**. Node.js + `ws` + Redis.

### 4.1 Backend (tri-layered)

- **Tools** (`src/tools/`) — external-dependency abstractions. Each has `interface.ts`, `index.ts` factory (selects from `DEPENDENCY_MODE`), and `implementations/{mock,redis,…}/`. Never imports handlers or workers.
- **Workers** (`src/workers/`) — business logic. Consumes tools through interfaces only.
- **Handlers** (`src/handlers/`) — protocol entry points. One per REST route / WebSocket message type.

Active tools post-reset:

| Tool | Purpose | Mock | LIVE |
|---|---|---|---|
| `queue` | Sorted-set queue + state hash | in-memory Map | Redis ZSET/HSET |
| `subscription` | Bucketed range fan-out (**new interface, W4**) | in-memory Map | **Redis PUBSUB (one channel per 1000-slot bucket)** |
| `activity` | Recent winners feed (renamed from `leaderboard`) | in-memory array | Redis ZSET by timestamp |
| `endurance` | All-time longest endurance hall (**new, W5**) | in-memory array | Redis ZSET scored by `duration_ms` desc |
| `statistics` | Daily departure counter | in-memory | Redis INCR, daily-TTL key |
| `imageGenerator` | OG image rendering | stub | Satori + Resvg + in-memory LRU cache (**W6**) |

Tools removed in W7: `auth/`, `storage/`, plus `workers/user/`, `workers/social/`.

### 4.2 Data

- **Redis** for queue, state, subscriptions (PUBSUB channels), activity, endurance, statistics. TCP mode; sub-ms per op.
- **No Supabase.** Cut.
- **No persistent identity.** Tokens in `sessionStorage` for display only. No reconnects.

### 4.3 Real-time Protocol

**Subscription tool interface (new for W4):**

```
subscribe(connId, minSeq, maxSeq, onMessage)   // registers local callback; SUBSCRIBEs to needed Redis channels
unsubscribe(connId)                             // drops local registration; UNSUBSCRIBEs Redis channels if no local subscribers remain
publish(seq, message)                           // PUBLISHes to bucket channel; local registrations dispatch via callback
```

`getSubscribers(seq)` is **removed**. Workers/bindings no longer iterate subscribers; they call `publish()` and let the tool dispatch.

**WebSocket** (full schema in `asyncapi.yaml`):

| Direction | Message | Payload |
|---|---|---|
| C→S | `join` | `{ token }` |
| C→S | `ping` | `{}` (every 5s **while visible**) |
| C→S | `visibility` | `{ visible: boolean }` (on `visibilitychange`) |
| C→S | `check` | `{ token }` |
| C→S | `viewport_subscribe` | `{ from_position, to_position }` |
| S→C | `joined` | `{ seq, position, waiting_position }` |
| S→C | `pong` | `{}` |
| S→C | `position_update` | `{ position, waiting_position }` (**computed from single ZRANGE snapshot**) |
| S→C | `range_state` | `{ slots[], total }` |
| S→C | `range_update` | `{ seq, position, state }` |
| S→C | `left` | `{ seq, departures_today }` |
| S→C | `check_ok` | `{ seq, duration_ms }` |
| S→C | `check_rejected` | `{ reason }` |
| S→C | `winner` | `{ seq, duration_ms }` (broadcast; `position` dropped from public payload) |

**REST** (full schema in `openapi.yaml`):

- `POST /join`, `POST /check`, `GET /viewport` — mirrors of WS.
- `GET /activity` — recent winners feed (replaces `GET /leaderboard`).
- `GET /endurance` — all-time endurance hall, top 10 by duration_ms desc.
- `GET /og-image?seq=N` — PNG with the sequence number. In-memory LRU cache, ~1h TTL.

Rate limiting: `POST /join` is IP-rate-limited to 10/min via Redis `INCR` + TTL. Soft-block returns `join_rejected` with `reason: "rate_limited"`.

### 4.4 Frontend

Single-file vanilla JS at `client/index.html`. Composed of:
- Fixed DOM pool of 120 checkbox nodes, recycled across logical scroll offset.
- Custom wheel/resize/keyboard scroll handler; `viewport_subscribe` on range change.
- UI state: header (position + departure counter + seq on hover), announcement banner, status line, activity feed panel, endurance hall panel, chat panel (P2P).
- Trystero-based P2P chat scoped to 100-slot neighborhoods; **ICE-failure fallback shows "chat unavailable" status** instead of silent break.

**Exit threshold (documented trigger for moving to a bundler):** introduce Vite + vanilla-TS modules when **`client/index.html` crosses 1500 lines OR a second route is needed**. Until then, no bundler.

### 4.5 Heartbeat

- Client pings every 5s **while `document.visibilityState === 'visible'`**. On `visibilitychange`, client sends a `visibility` message with the new state and pauses/resumes the ping loop.
- Server tracks `last_ping_ms` per token + a boolean `is_visible`. Eviction fires on `now - last_ping_ms > 12_000` **only when `is_visible`** (most recent state received).
- A tab hidden for >N minutes will still be evicted when revealed if the revealed tab then fails to ping for 12s. No free grace after unhide.
- "Deliberate cruelty" preserved: closing / navigating / idle-while-visible all evict within ~15s. What we kill: false evictions from iOS JS suspension and Chrome background throttling.

## 5. Scope Reset (locked)

A prior iteration expanded Weekend 7 far beyond the original stretch. That scope is cut. The reset:

| Feature | Decision |
|---|---|
| P2P neighborhood chat (Trystero) | **Keep.** Frontend-only, zero server cost. |
| Supabase auth (email/password, magic link, OTP) | **Cut.** |
| Named checkboxes | **Cut.** |
| Badges | **Cut.** |
| Follows | **Cut.** |
| Seasons / superlatives (schemas only) | **Cut.** |
| Turn timer (30-min eviction) | **Cut.** — was never implemented. |

The guiding constraint: **anonymous, ephemeral, about the number.**

## 6. Current State Audit (ground truth)

| Weekend | Original Goal | Reality |
|---|---|---|
| W1 | Two-tab mechanic | ✅ Works. |
| W2 | Redis + heartbeat | ✅ Works. |
| W3 | Virtual scroll | 🟡 Implemented; not verified at scale or for far-range correctness. |
| W4 | Range subscriptions | 🟡 Mock only. Interface wrong shape (pull, not push). **Critical: `getPositionsBehind` is O(N) Redis round-trips per mutation — production landmine.** |
| W5 | Ghost / banner / counter / title / leaderboard | 🟡 Four of five wired; leaderboard UI missing; ghost fade ends at 0.12 then instant-disappears. |
| W6 | OG image / deploy | 🟡 OG image + Docker + fly.toml done. Not deployed publicly. |
| W7 | Stretch (pivoted) | 🔴 Out-of-scope code still present; `QueueWorker.nameCheckbox` couples queue worker to `storage` tool. |

## 7. Remediation Plan (ordered for correct execution)

The **new execution order** is:

```
W2.5 → W4 → W3 → W5 → W7 → W6 → W8
```

Backend correctness before frontend hardening. Cleanup before deploy. Each weekend ships a PR with tests. Each PR gets `/review`. W6 ships via `/ship` + `/land-and-deploy`.

### Weekend 2.5 — Test scaffold (NEW)

The codebase has zero tests; every subsequent weekend needs a safety net.

- Install `vitest` (TS-native, aligns with existing `tsx`/`tsc`).
- Add `npm test` script.
- Write first-wave unit tests against existing `QueueWorker` + mock tools: `join`, `check` eligibility, `leave`, `cleanup`, `getViewport`. These cover W1/W2 behavior and lock in a regression baseline.
- Add `docs/testing.md` (short, ~1 page): "every new code path ships with a test."
- Files: `package.json`, `vitest.config.ts` (new), `src/workers/queue/index.test.ts` (new).

### Weekend 4 — Subscription refactor + broadcast fix + heartbeat visibility

Biggest weekend. Replaces the W4 SET-per-bucket plan; also folds in the N+1 broadcast fix and the visibility-API heartbeat.

**Subscription tool (PUBSUB):**
- Reshape `ISubscription`: remove `getSubscribers(seq)`; add `publish(seq, message)`; `subscribe(connId, min, max, onMessage)` takes a dispatch callback.
- Write `src/tools/subscription/implementations/redis/index.ts` using two Redis clients (one SUBSCRIBE, one PUBLISH; pubsub protocol requirement). Channel-per-bucket `waiting_game:bucket:N`. Process only subscribes to channels with ≥1 local callback; unsubscribes when the last local callback drops.
- Update the in-memory mock to match the new `publish`/dispatch shape so mock and redis are interface-equivalent.
- Update `src/handlers/websocket/shared.ts` and `src/workers/queue/index.ts` to call `publish` instead of iterating subscribers.

**Broadcast N+1 fix:**
- `getPositionsBehind` currently does one ZRANGE + 2N GET per mutation. Replace with: **one ZRANGE snapshot, compute each connected client's position by its rank in the snapshot, publish per-bucket instead of per-token**. Drops from O(N) Redis calls to O(1) per mutation.
- Add test: "mutation at seq X triggers exactly one ZRANGE + one PUBLISH; no per-client Redis calls."

**Heartbeat visibility:**
- Server: track `is_visible` per token; eviction gate uses `is_visible === true`.
- Client: send `visibility` message on `visibilitychange`; pause/resume the 5s ping loop.
- Test: hidden client does not get evicted after 60s of no pings; same client upon unhide is given one ping window.

**W4 Acceptance (tightened):**
- Two browsers: tab A at seq 50,000, tab B at seq 1,001. Tab A scrolls to view seq 1,000 range. Tab B closes. Tab A sees a `range_update` with ghost state within 1s. **Regression-critical — iron-rule test.**

### Weekend 3 — Virtual scroll hardening (now testing real product behavior)

With W4 correct, scroll hardening can verify actual state at far ranges, not just local DOM recycling.

- Extract `CHECKBOX_WIDTH_PX = 34` into a named constant with a comment.
- Unit tests for `updateScroll` (clamping at 0 + max, absolute jump, delta at boundaries), `syncViewport` (sends only on range change), `render` (slot present / absent / ghost / myChecked).
- **Correctness tests (not just "no lag"):** at scroll offset corresponding to seq 1,000,000, assert that the rendered slots reflect the `range_state` payload — state values, positions, seq numbers. Use a mocked WS client to inject `range_state`.
- Manual: 2-tab smoke test + rapid-wheel 10s + window resize mid-scroll (pool stays at 120).
- `docs/virtual-scroll.md` (short): invariants + test script.

### Weekend 5 — Social polish + two feed panels

- **Activity feed UI (new panel):** toggleable panel calling `GET /activity` + refreshing on `winner` WS event. Copy: "The contest recognizes contestant #47,291, who endured for 2h 14m." (Uses `seq`, not `position`.)
- **Endurance hall UI (new panel + new tool):** second toggleable panel. New tool `endurance/` with mock + Redis ZSET by duration_ms desc. `GET /endurance` returns top 10. Client renders: "Longest endurance on record: #42,118 — 3d 4h. #8,203 — 2d 19h. …"
- **Ghost animation:** change `.slot.ghost { opacity: 0 }` so fade aligns with 30s slot delete (current code lands at opacity 0.12 then vanishes — fix is 1 line + a test).
- **Winner banner copy cycling:** 5 phrasings per event type in `client/src/copy.ts`, picked via existing `getRandom`. Lock the number at 5 (resolves the 3-5 vs 5-8 contradiction in prior docs). Test: consecutive events produce different strings.
- **Tab title ordinals:** unit test `getOrdinal` for 1–3, 11–13, 21–23, 111–113, 1,000,001.
- **Departure counter rollover:** unit test around UTC midnight.
- **OG image endpoint:** update signature to `GET /og-image?seq=N`; update Satori template to render "#N" + "contestant of The Waiting Game" (no position).

### Weekend 7 — Cleanup + P2P chat polish

**Explicit deletion order (respects the import graph):**
1. Remove auth/social REST handlers from `src/handlers/rest/index.ts`: `signUpHandler`, `signInHandler`, `sendOtpHandler`, `verifyOtpHandler`, `nameCheckboxHandler`, `getBadgesHandler`, `followHandler`, `listFollowsHandler`.
2. Remove matching bindings from `src/routes.ts`.
3. Remove `nameCheckbox` method and `storage` import from `src/workers/queue/index.ts`.
4. Delete `src/workers/user/`, `src/workers/social/`.
5. Delete `src/tools/auth/`, `src/tools/storage/`.
6. Remove `Season` + `Superlative` from `schemas.yaml`; matching paths from `openapi.yaml`.
7. Remove `@supabase/supabase-js` from `package.json`; run `npm install` to update lockfile.
8. Run `npm run typecheck && npm test` — must be green before committing.

**P2P chat polish:**
- Verify Trystero room-switch fires on 100-slot boundary cross via unit test + 2-browser manual test.
- Document and handle ICE failure: on `onPeerError` / ICE gathering timeout, show status "Chat unavailable in this neighborhood." instead of silent failure.
- Add `docs/p2p-chat.md` with NAT/ICE fallback behavior.
- Files: `client/index.html:385,439`.

### Weekend 6 — Deploy + hardening

- `fly launch` → provision app + `fly redis create` colocated. Set secrets (`REDIS_URL`).
- Acquire domain (`waitinggame.lol` or fallback). If taken, document alternate and update share card text.
- Minimal GitHub Actions: `lint + typecheck + build:dry + test` on PR (no deploy yet; manual `fly deploy` for v1).
- **Docs guardrail CI:** grep check that fails if `README.md`, `DESIGN.md`, `TODOS.md` mention any cut feature (`auth`, `signup`, `signin`, `badge`, `season`, `superlative`, `turn timer`, `30 minutes`). Cheap, prevents drift.
- **Rate limiting:** implement `/join` 10/min per IP via Redis `INCR` + TTL; soft-block returns `join_rejected`.
- **OG image cache:** in-memory LRU keyed by `seq`, 1h TTL, ~100 entry cap. Satori regen is expensive; share URLs are hammered by social crawlers.
- **Server-restart maintenance copy:** client shows "The contest is being rebuilt. It will resume momentarily." on WS close; server adds a pre-shutdown broadcast of a `maintenance` message in the 5s before `SIGTERM` completes.
- Smoke test: two browsers on the real domain, full W1 mechanic; scroll-jump to far position; `/og-image?seq=47291` renders; `/activity` + `/endurance` non-empty; rate limiter returns `join_rejected` on 11th join/min.

### Weekend 8 — E2E sweep + coverage audit

- Add Playwright. Write:
  - **W1 mechanic** — two-tab full loop.
  - **W4 far-viewport** — iron-rule regression test.
  - **Ghost fade** — visual smoke (opacity trajectory).
  - **Rate-limit** — 11 rapid joins from same IP; 11th gets `join_rejected`.
- Coverage audit: every remediation code path has ≥1 unit test; critical paths have an E2E.
- Wire Playwright into CI (after the main test job).

## 8. Process

1. ✅ `/plan-eng-review` (this doc).
2. **`/design-consultation`** — expand `VISUAL_SYSTEM.md` into a typography scale, color tokens, component states, motion spec. Baseline for W5/W7 polish.
3. Execute **W2.5 → W4 → W3 → W5 → W7 → W6 → W8** in order, one PR per weekend.

## 9. Critical Files

**Modify / verify:**
- `client/index.html` — single-file frontend (W3, W5, W7 chat, design polish)
- `src/tools/subscription/interface.ts` — reshape (W4)
- `src/tools/subscription/implementations/{mock,redis}/index.ts` — **new redis** (W4)
- `src/tools/endurance/` — **new tool** (W5)
- `src/workers/queue/index.ts` — broadcast refactor (W4), nameCheckbox removal (W7)
- `src/handlers/websocket/shared.ts` — broadcast refactor (W4)
- `src/handlers/rest/index.ts` — activity + endurance + og-image-seq (W5); auth/social deletions (W7); rate limit + cache (W6)
- `Dockerfile`, `fly.toml` — W6
- `package.json` — strip Supabase (W7); add vitest (W2.5), playwright (W8)
- `openapi.yaml`, `asyncapi.yaml`, `schemas.yaml` — keep in sync with code

**Delete (W7):** `src/tools/auth/`, `src/tools/storage/`, `src/workers/user/`, `src/workers/social/`, auth/social handlers + bindings.

**Reusable helpers (already in place):**
- `getOrdinal` — `client/index.html:642`
- `showAnnouncement` / `showStatus` — `client/index.html:688,697`
- `formatDuration` — `client/index.html:704`
- `POSITIVE_COLORS` / `NEGATIVE_COLORS` — defined in client script
- Tri-layer factory pattern — `src/tools/*/index.ts`

## 10. Success Criteria (ship-ready checklist)

Run this list after executing W2.5 → W8.

1. **Two-tab mechanic (W1 regression):** Tab 2 joins while Tab 1 waits; Tab 1 checks; Tab 2 activates within 1s. Tab 2 closes; Tab 1 sees departure (ghost, then delete) within 15s.
2. **Viewport seeking (W4 regression):** Tab A at seq 50,000 subscribes to seq 1,000 range; Tab B at seq 1,001 closes; Tab A receives `range_update` within 1s. **Iron rule.**
3. **Scroll correctness (W3):** from any viewport, scroll-jump to seq 1,000,000; rendered slot states + position math match the injected `range_state`.
4. **Social polish (W5):** a check produces a cycled-copy banner + an activity entry + (if duration qualifies) an endurance entry, all within 1s, across all open tabs. Tab title shows `#seq — The Waiting Game`. Ghost fades smoothly to opacity 0 at 30s.
5. **Deploy (W6):** production URL works; `/og-image?seq=47291` renders; `/activity` + `/endurance` non-empty; 11th join/min/IP returns `join_rejected`. Screenshot at seq N is shareable without context.
6. **Chat (W7):** two tabs in the same 100-slot neighborhood see each other's messages; scrolling past the boundary severs. ICE failure shows "Chat unavailable" status, not silence.
7. **Docs guardrail CI:** PR that re-adds "turn timer" or "signup" in docs fails CI.
8. **Tests:** `npm test` is green on CI; Playwright E2E suite runs on CI and covers W1 + W4.
9. **Heartbeat:** backgrounding a tab for 60s does not evict; revealing the tab gives one ping window.

## 11. Open Questions

- **Domain:** `waitinggame.lol` availability check before W6. Fallback TBD.
- **P2P chat neighborhood size:** 100 is a guess. Revisit after production usage.
- **Endurance hall cap size:** top 10 initially; may grow to top 100 once we have enough data. No code change — just a Redis `ZRANGE 0 99`.

## 12. Appendix: Decisions from `DESIGN-ORIGINAL.md` Still in Force

- Sequence numbers immutable; positions computed. (Original §Recommended Approach)
- Range subscriptions bucketed at 1,000 slots. (Original §Recommended Approach)
- Ghost fade: 30s, frontend-only cosmetic. (Original §Open Question 3)
- No reconnects. Session tokens display-only. (Original §Open Question 1)
- Server restart = all clients re-queued at the back. Known v1 limitation, mitigated with maintenance banner copy (§Remediation W6). (Original §Server restart consequence)
- Anonymous only. (Original §Constraints)
- Rate limit: 10 joins/min per IP, soft-block. (Original §Open Question 6 — **restored in W6** after drifting out of the intermediate plan.)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | **CLEAR** | 4 issues resolved, 4 cross-model tensions resolved, 9 minor improvements folded, 2 critical gaps flagged w/ tests |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX (outside voice):** 4 substantive tensions surfaced (canonical number, weekend ordering, heartbeat on mobile, leaderboard semantics) — all resolved via AskUserQuestion; 9 minor improvements folded without separate tension.
**CROSS-MODEL:** Both models agree W8 tests-last was wrong; both flagged N+1 broadcast (though this review found it first in code, Codex independently flagged test sequencing).
**UNRESOLVED:** 0.
**VERDICT:** ENG CLEARED — ready to implement after `/design-consultation`.
