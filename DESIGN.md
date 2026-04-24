# Design: The Waiting Game

**Status:** Active source of truth — supersedes all prior design docs.
**Last updated:** 2026-04-24
**Historic artifacts (preserved, not edited):**
- `DESIGN-ORIGINAL.md` — the original weekend-by-weekend plan authored by `/office-hours` on 2026-04-22. Architecture decisions from this doc are still in force; the weekend scoping has been superseded by the remediation plan below.
- `GEMINI-DESIGN.md` — an intermediate plan authored mid-project that expanded Weekend 7 into a large account/social/seasonal feature set. That scope has since been cut (see "Scope Reset" below). Backend scaffolding from this phase remains in the repo and is slated for removal in Weekend 7 of the remediation.

---

## 1. Overview

The Waiting Game is a real-time, anonymous queue rendered as an impossibly-long horizontal strip of checkboxes. You join at the back. You can check your box only when every box ahead of you is either checked or its owner has left. Leaving the tab evicts you immediately and everyone behind shifts forward. Winning — checking your box when eligible — earns a global announcement and a leaderboard entry.

**The product is the number.** "#47,291 in line" is the screenshot. Everything else — the strip, the ghosting, the leaderboard, the counter — serves the shareable moment.

## 2. Vision & Tone

Matter-of-fact deadpan applied to sustained absurdity. Reference points: Blaseball's treatment of escalating unreality, Welcome to Night Vale's civic-announcement register, the 20th-century endurance contests (Hands on a Hardbody, radio-DJ car giveaways, dance marathons) that began as stunts and became something else. The interface is indifferent. The contest has always been running. It will continue.

**Copy rules:**
- No internet shorthand ("rage quit" is banned). Prefer public-notice phrasing: "returned to the world," "the abyss stopped staring back," "the contest notes your participation."
- Announcements cycle. No single copy string should appear twice in a session.
- Winning and losing carry the same emotional weight — neither is celebrated, neither is mourned.

The visual system is described in `VISUAL_SYSTEM.md` ("Vibrant Indifference") and will be expanded via `/design-consultation` as part of the remediation sequence.

## 3. Core Mechanic

1. New connection → assigned an immutable, monotonically increasing `sequence_number` (the canonical queue key).
2. Displayed `position` is **computed**, never stored: `count of active sequence numbers less than yours`.
3. Eligibility to check: you are at rank 0 of the `waiting_queue` (the subset of connected, unchecked users).
4. On check: atomic Redis transaction validates eligibility, records the winner, broadcasts a `winner` event, increments the leaderboard.
5. On tab close / 12s of missed heartbeats: eviction, `left` event broadcast to subscribers of your range, your slot fades client-side over 30s.
6. A freshly-connected client always lands at the back. **Reconnects are not honored** — the session token is display-only. Deliberate.

This design separates queue order (the sequence number, immutable) from position (computed on demand), which eliminates the fan-out problem: when user #N leaves, we do not broadcast "shift by one" to every active client. Clients in the relevant range recompute positions from the `left` event.

## 4. Architecture

Approach B from the original design — **chosen and implemented**. Node.js + `ws` + Redis sorted set.

### 4.1 Backend (tri-layered)

Imposed as a mid-project refactor and retained. The three layers:

- **Tools** (`src/tools/`) — abstractions for external dependencies. Each tool has an `interface.ts`, an `index.ts` factory that selects an implementation from `DEPENDENCY_MODE` (`MOCK` | `LIVE`), and `implementations/{mock,redis,…}/`. Tools never import handlers or workers.
- **Workers** (`src/workers/`) — business logic. Consume tools through their interfaces. Do not touch Redis, Supabase, or any external library directly.
- **Handlers** (`src/handlers/`) — protocol entry points. One handler per REST route or WebSocket message type. Validates input, calls a worker, formats output.

Tools currently in active scope after the reset:

| Tool | Purpose | Mock | LIVE |
|---|---|---|---|
| `queue` | Sorted-set queue + state hash | in-memory Map | Redis ZSET/HSET |
| `subscription` | Bucketed range fan-out | in-memory | Redis SET-per-bucket (**to be written — W4**) |
| `leaderboard` | Recent winners | in-memory array | Redis ZSET by timestamp |
| `statistics` | Daily departure counter | in-memory | Redis INCR with daily-TTL key |
| `imageGenerator` | OG image rendering | stub | Satori + Resvg |

Tools being removed in W7 (scope cut): `auth/`, `storage/`, plus `workers/user/`, `workers/social/`.

### 4.2 Data

- **Redis** for queue, state, subscriptions, leaderboard, and statistics. TCP mode (not HTTP) to keep per-op latency sub-millisecond.
- **No Supabase.** Was introduced for the auth/accounts pivot; being removed.
- **No per-user persistent identity.** Tokens live in `sessionStorage` for display only; server does not accept reconnects.

### 4.3 Real-time Protocol

**WebSocket** (full schema in `asyncapi.yaml`):

| Direction | Message | Payload |
|---|---|---|
| C→S | `join` | `{ token }` |
| C→S | `ping` | `{}` (every 5s) |
| C→S | `check` | `{ token }` |
| C→S | `viewport_subscribe` | `{ from_position, to_position }` |
| S→C | `joined` | `{ seq, position, waiting_position }` |
| S→C | `pong` | `{}` |
| S→C | `position_update` | `{ position, waiting_position }` |
| S→C | `range_state` | `{ slots[], total }` |
| S→C | `range_update` | `{ seq, position, state }` |
| S→C | `left` | `{ seq, departures_today }` |
| S→C | `check_ok` | `{ position, duration_ms }` |
| S→C | `check_rejected` | `{ reason }` |
| S→C | `winner` | `{ seq, position, duration_ms }` (broadcast) |

**REST** (full schema in `openapi.yaml`):

- `POST /join`, `POST /check`, `GET /viewport` — mirrors of the WS path, kept for scripting/debug.
- `GET /leaderboard` — returns recent winners (array of `{ seq, position, duration_ms, timestamp }`).
- `GET /og-image?position=N` — PNG with the position number, for share-card use.

### 4.4 Frontend

Single-file vanilla JS at `client/index.html`. Composed of:

- A fixed DOM pool of ~120 checkbox nodes, recycled across a logical scroll offset. Checkbox width is a single constant driving the strip layout.
- A custom wheel/resize/keyboard scroll handler that maintains `scrollOffset` and the visible range, triggering `viewport_subscribe` on range changes.
- UI state: header (position + departure counter), announcement banner (cycles with winner events), status line, chat panel (P2P).
- Trystero-based P2P chat scoped to 100-slot neighborhoods — zero backend involvement.

No bundler, no framework. This is deliberate for now; the app is ~800 lines and the lack of toolchain has been a net positive for iteration speed. A bundler + component framework is on the table **only** if the frontend surface grows significantly past the remediation.

## 5. Scope Reset (the important part)

A prior iteration of this project (tracked in `GEMINI-DESIGN.md`) expanded Weekend 7 from "stretch/TBD" into a large scope: Supabase-backed user accounts, magic-link + OTP auth, badges, follows, named checkboxes, seasons, superlatives, and a "turn timer" — a 30-minute eviction window for the user at position #1. Most of the backend was scaffolded. The UI for any of it was not built. The turn timer was **claimed in commits and documentation but does not exist in code** (only a 12-second inactivity eviction exists, which is a different thing).

**The reset:**

| Feature | Status | Decision |
|---|---|---|
| P2P neighborhood chat (Trystero) | ✅ working | **Keep.** Frontend-only, zero server cost, adds social texture. |
| Supabase auth (email/password, magic link, OTP) | backend only | **Cut.** Strip tool, worker, handlers, dep. |
| Named checkboxes (logged-in users) | backend only | **Cut.** |
| Badges | backend only | **Cut.** |
| Follows | backend only | **Cut.** |
| Seasons (schemas only) | schema YAML only | **Cut.** Remove from `schemas.yaml`. |
| Superlatives (schemas only) | schema YAML only | **Cut.** Remove from `schemas.yaml`. |
| Turn timer (30-min eviction) | **does not exist** | **Cut.** Remove from README, TODOs, commit narrative. |

The guiding constraint: **the game is anonymous, ephemeral, and about the number.** Adding logged-in identity undermined that. The reset restores the original thesis.

## 6. Current State Audit (ground truth, not claims)

Derived from reading the code at this commit, not from `GEMINI-DESIGN.md`'s completion checklist.

| Weekend | Original Goal | Reality |
|---|---|---|
| W1 | Two-tab mechanic | ✅ Works. WS + computed positions + full two-tab loop. |
| W2 | Redis + heartbeat | ✅ Works. Redis ZSET queue, 12s inactivity eviction, `npm run dev:all` boots Redis + server. |
| W3 | Virtual scroll (120 DOM pool, custom wheel) | 🟡 Implemented at `client/index.html:449` / `:591` / `:515`. Not verified at scale; edge cases (resize mid-scroll, scroll to #10M, touch input) not tested. |
| W4 | Range subscriptions (1000-slot buckets) | 🟡 Mock implementation only. `src/tools/subscription/implementations/` lacks a `redis/` impl despite the tri-layer mandate. |
| W5 | Ghost fade, winner banner, departure counter, tab title, leaderboard | 🟡 Four of five wired (`client/index.html:688,680,666-676,767,782`). **Leaderboard UI panel is missing** — REST `/leaderboard` endpoint exists, client never calls it. |
| W6 | OG image, Fly.io deploy, domain | 🟡 `Dockerfile` builds, `fly.toml` configured, Satori image generator implemented. **No public URL.** No domain acquired. Not verified in production. |
| W7 | Stretch / TBD (original) | 🔴 Pivoted beyond scope. See "Scope Reset." |

## 7. Remediation Plan (Weekends 3–8)

Each weekend ships a PR. Each PR gets `/review` before merge. W6 ships via `/ship` + `/land-and-deploy`.

### Weekend 3 — Virtual Scroll: verify + harden

- Manual acceptance: scroll to position #1,000,000 with no lag; 10s of rapid-wheel with no DOM pool growth; resize mid-scroll; keyboard jump.
- Extract `CHECKBOX_WIDTH_PX` into a single documented constant (currently 34px per `VISUAL_SYSTEM.md`).
- If `/plan-eng-review` agrees, add a short `docs/virtual-scroll.md` covering invariants + a 2-tab manual test script.
- Files: `client/index.html:449,515,591,610`.

### Weekend 4 — Range Subscriptions: finish the Redis impl

- Write `src/tools/subscription/implementations/redis/index.ts` backing the bucketed fan-out with Redis SET-per-bucket membership.
- Verify the original DESIGN W4 acceptance: "scroll to #1,000 while at #50,000 and see live state" across two browsers.
- Integration test: two WS clients + one subscribing to a non-overlapping range receives only the expected events.
- Ensure `range_unsubscribe` fires cleanly on viewport change (no stale bucket membership).
- Files: `src/tools/subscription/interface.ts`, `src/tools/subscription/implementations/{mock,redis}/index.ts`, `src/handlers/websocket/bindings.ts`, `src/workers/queue/index.ts`.

### Weekend 5 — Social polish: leaderboard UI + finish-what's-started

- **Leaderboard UI (missing):** add a panel that polls `GET /leaderboard` and refreshes on `winner` events. Render winners in the public-notice tone ("The contest recognizes contestant #47,291, who endured for 2h 14m.").
- **Ghost animation polish:** current 30s `setTimeout` is a delete, not an animation. Add a CSS fade transition so it reads as "a candle going out," not "a blink."
- **Winner banner copy cycling:** currently a single template at `client/index.html:782`. Add 3–5 phrasings in the Night Vale register; pick at random.
- **Tab title ordinals:** verify `getOrdinal` at `client/index.html:642` handles the 11/12/13 edge cases.
- **Departure counter rollover:** verify `waiting_game:departures:YYYY-MM-DD` rolls over at UTC midnight; test.

### Weekend 6 — Actually deploy

- Provision Fly.io app + colocated Redis; set secrets.
- Acquire a real domain (`waitinggame.lol` or alternate) or stopgap on `fly.dev`.
- Smoke-test live: two browsers on the real domain, full W1 mechanic; far-position viewport-subscribe; `/og-image?position=47291` renders.
- Add a minimal GitHub Actions workflow: `lint + typecheck + build:dry` on PR. No deploy pipeline yet — manual `fly deploy` per the original plan.

### Weekend 7 — The cleanup + P2P chat polish

Delete (after confirming no references remain):
- `src/tools/auth/`
- `src/tools/storage/`
- `src/workers/user/`
- `src/workers/social/`
- REST handlers for `/signup`, `/signin`, `/auth/otp/*`, `/checkbox/name`, `/user/badges`, `/follow` (both verbs)
- Route bindings in `src/routes.ts` for the above
- `@supabase/supabase-js` dep in `package.json`
- `Season` + `Superlative` in `schemas.yaml`; matching paths in `openapi.yaml`

P2P chat polish:
- Verify Trystero room-switch fires as `scrollOffset` crosses a 100-slot boundary.
- Test NAT/ICE across two browsers; document fallback behavior.
- Polish chat UI against the design system from `/design-consultation`.
- Files: `client/index.html:385,439`.

### Weekend 8 — Test harness

The codebase has zero tests. 2,700 lines of production code deserve a safety net before we iterate further.

- Add `vitest` (TS-native, lightweight, aligns with the existing `tsx`/`tsc` toolchain).
- First-wave coverage:
  - `QueueWorker` unit tests against the mock tool (join, check-eligibility, departure, computed position).
  - `subscription` tool tests (mock + redis) for bucket membership + fan-out correctness.
  - One Playwright or Puppeteer end-to-end test: the W1 two-tab mechanic.
- Wire `npm test` into the GitHub Actions job from W6.

## 8. Process (the three-step drive)

1. **`/plan-eng-review`** on this document — walks W3–W8, locks architecture corrections, challenges edge cases. Expect pushback on the W4 Redis implementation shape and the W7 deletion order (import-graph concerns).
2. **`/design-consultation`** — expands `VISUAL_SYSTEM.md` into a full design system (typography scale, color tokens, component states, motion spec). Produces the visual baseline against which W5/W7 UI polish is done.
3. **Execute W3 → W8** in order, one PR per weekend, `/review` before each merge, `/ship` + `/land-and-deploy` for W6.

## 9. Critical Files

**Modify / verify:**
- `client/index.html` — single-file frontend (W3, W5, W7 chat, design polish)
- `src/tools/subscription/implementations/redis/index.ts` — **new** (W4)
- `src/tools/{leaderboard,statistics}/implementations/redis/index.ts` — verify (W5)
- `src/workers/queue/index.ts` — verify (W3–W5)
- `src/handlers/websocket/bindings.ts` — verify (W4)
- `Dockerfile`, `fly.toml` — (W6)
- `package.json` — strip Supabase dep (W7), add `vitest` (W8)

**Delete (W7):**
- `src/tools/auth/`, `src/tools/storage/`, `src/workers/user/`, `src/workers/social/`
- Auth/social bindings in `src/routes.ts` and handlers in `src/handlers/rest/index.ts`

**Reusable helpers already in place (don't rewrite):**
- `getOrdinal` — `client/index.html:642`
- `showAnnouncement` / `showStatus` — `client/index.html:688,697`
- `formatDuration` — `client/index.html:704`
- `POSITIVE_COLORS` / `NEGATIVE_COLORS` palettes — defined in client script
- Tri-layer factory pattern — `src/tools/*/index.ts`

## 10. Success Criteria (ship-ready checklist)

Run this list after executing W3–W8.

1. **Two-tab mechanic:** tab 1 checks, tab 2 activates, tab 2 closes, tab 1 sees departure within 15s.
2. **Viewport seeking:** from position #50,000, scroll-jump to #1,000; live state within 1s; scroll to #1,000,000 without lag.
3. **Social polish:** a check produces a cycled-copy banner + a leaderboard panel entry within 1s, across all open tabs; tab title reflects position; departures counter updates.
4. **Deploy:** open the production URL in an incognito window; full mechanic works; `/og-image?position=47291` renders; the resulting screenshot is genuinely shareable without context.
5. **Chat:** two tabs in the same 100-slot neighborhood see each other's messages; scrolling past the boundary severs the link.
6. **Tests:** `npm test` is green on CI for every PR.
7. **Docs:** no documentation references a feature that doesn't exist.

## 11. Open Questions

- **Domain:** is `waitinggame.lol` still available / desired? If taken, what's the fallback?
- **P2P chat scaling:** the 100-slot neighborhood size is a guess. Do we tune this, or validate with usage first?
- **Copy variety bank:** how many phrasings per event type is "enough" before it becomes maintenance burden? Lean toward a small cycling pool (5–8) per event.
- **`/plan-eng-review` may surface more.** This document is the input; expect refinement.

## 12. Appendix: Decisions from `DESIGN-ORIGINAL.md` Still in Force

Called out so nobody re-litigates them:

- Sequence numbers are immutable; positions are computed. (Original §Recommended Approach)
- Range subscriptions bucketed at 1,000 slots per process. (Original §Recommended Approach)
- Heartbeat: 5s ping, 12s stale timeout. (Original §Liveness via heartbeat)
- Ghost fade: 30s, frontend-only cosmetic. (Original §Open Question 3)
- No reconnects. Session tokens are display-only. Cruelty is on-brand. (Original §Open Question 1)
- Server restart = all clients re-queued at the back. Known v1 limitation. (Original §Server restart consequence)
- Anonymous only — no auth required. (Original §Constraints) — **restated here after the scope reset.**
- Rate limit: 10 joins/min per IP, soft-block with `join_rejected`. (Original §Open Question 6)
