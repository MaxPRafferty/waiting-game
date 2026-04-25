# TODOs

Reflects actual state after the 2026-04-24 scope reset + `/plan-eng-review`. The authoritative weekend-by-weekend plan lives in `DESIGN.md`. Historic claims that were never implemented have been removed. Order of execution is:

**W2.5 → W4 → W3 → W5 → W7 → W6 → W8**

(Backend correctness before frontend hardening. Cleanup before deploy.)

## Remediation Work (see `DESIGN.md` §7)

### Weekend 2.5 — Test scaffold
- [x] Install `vitest`; add `npm test`
- [x] First-wave `QueueWorker` unit tests against mock (join, check, leave, cleanup, getViewport)
- [x] Write `docs/testing.md` (one page, "every new code path ships with a test")

### Weekend 4 — Subscription refactor + broadcast fix + heartbeat visibility
- [x] Reshape `ISubscription`: remove `getSubscribers`; add `publish(seq, message)`; callback in `subscribe`
- [x] Write `src/tools/subscription/implementations/redis/index.ts` using Redis PUBSUB (two clients, channel-per-bucket)
- [x] Update mock impl to match new shape
- [x] Refactor `src/handlers/websocket/shared.ts` + `src/workers/queue/index.ts` to use `publish`
- [x] Fix N+1 broadcast: one ZRANGE snapshot, compute positions by rank, publish per-bucket
- [x] Unit test: mutation triggers exactly one ZRANGE + one PUBLISH; no per-client Redis calls
- [x] Server: track `is_visible` per token; gate eviction on `is_visible === true`
- [x] Client: pause ping loop on `visibilitychange`; send `visibility` WS message on state change
- [x] Unit test: hidden client not evicted after 60s; revealed client given one ping window
- [x] **IRON-RULE regression test:** far-viewport (seq 50K) sees `range_update` when near-front (seq 1,001) leaves

### Weekend 3 — Virtual scroll hardening
- [ ] Extract `CHECKBOX_WIDTH_PX = 34` with comment
- [ ] Unit tests for `updateScroll` (clamp 0, clamp max, absolute, delta at boundaries)
- [ ] Unit tests for `syncViewport` (only sends on range change)
- [ ] Unit tests for `render` (slot present/absent/ghost/myChecked)
- [ ] Correctness test at seq 1,000,000: rendered slot states + positions match injected `range_state`
- [ ] Manual: 2-tab smoke, rapid wheel 10s, window resize mid-scroll
- [ ] Write `docs/virtual-scroll.md` (short)

### Weekend 5 — Activity feed + endurance hall + polish
- [ ] Activity feed UI panel (calls `GET /activity`, refreshes on `winner` WS event)
- [ ] New `endurance` tool (mock + Redis ZSET by duration_ms desc)
- [ ] `GET /endurance` endpoint, top 10 returned
- [ ] Endurance hall UI panel (second toggleable panel)
- [ ] Change `.slot.ghost { opacity: 0 }` so fade aligns with 30s delete; regression test
- [ ] `client/src/copy.ts` with 5 phrasings per event type; `getRandom` utility; no-repeat-in-session guarantee
- [ ] Winner banner uses cycled copy; test consecutive events produce different strings
- [ ] Unit tests for `getOrdinal`: 1-3, 11-13, 21-23, 111-113, 1,000,001
- [ ] Unit test for UTC midnight departure counter rollover
- [ ] OG image endpoint signature: `GET /og-image?seq=N`; Satori template renders `#N`
- [ ] Winner WS payload drops `position` (public payload is `{ seq, duration_ms }`)
- [ ] Tab title format: `#N — The Waiting Game` during waiting; `✓ #N` after winning
- [ ] Header shows position during play; hover reveals seq

### Weekend 7 — Scope cleanup + P2P chat polish
**Deletion order (respects import graph):**
- [ ] (1) Remove auth/social REST handlers from `src/handlers/rest/index.ts`
- [ ] (2) Remove auth/social bindings from `src/routes.ts`
- [ ] (3) Remove `nameCheckbox` method + `storage` import from `src/workers/queue/index.ts`
- [ ] (4) Delete `src/workers/user/` and `src/workers/social/`
- [ ] (5) Delete `src/tools/auth/` and `src/tools/storage/`
- [ ] (6) Remove `Season` + `Superlative` from `schemas.yaml`; matching paths from `openapi.yaml`
- [ ] (7) Remove `@supabase/supabase-js` from `package.json`; update lockfile
- [ ] (8) Run `npm run typecheck && npm test` — must be green before commit

**P2P chat polish:**
- [ ] Trystero room-switch on 100-slot boundary: unit test + 2-browser manual test
- [ ] ICE-failure fallback: show "Chat unavailable in this neighborhood" status
- [ ] Write `docs/p2p-chat.md` with NAT/ICE behavior

### Weekend 6 — Deploy + hardening
- [ ] `fly launch` + `fly redis create` colocated; set secrets
- [ ] Acquire `waitinggame.lol` (or fallback); update share-card text
- [ ] GitHub Actions: `lint + typecheck + build:dry + test` on PR
- [ ] **Docs guardrail CI:** grep check that fails if cut features appear in docs (`auth`, `signup`, `signin`, `badge`, `season`, `superlative`, `turn timer`, `30 minutes`)
- [ ] `/join` rate limit: Redis `INCR` + TTL, 10/min/IP, soft-block returns `join_rejected`
- [ ] OG image LRU cache (in-memory, keyed by seq, 1h TTL, ~100 entries)
- [ ] Server-restart maintenance copy: pre-shutdown `maintenance` broadcast + client reconnect banner
- [ ] Production smoke: full W1 mechanic, far-viewport seek, OG image renders, `/activity` + `/endurance` work, rate limit trips at 11th

### Weekend 8 — E2E sweep + coverage audit
- [ ] Install Playwright
- [ ] E2E: W1 two-tab mechanic
- [ ] E2E: W4 far-viewport (iron-rule regression)
- [ ] E2E: ghost fade visual smoke
- [ ] E2E: rate-limit 11th-join trip
- [ ] Coverage audit: every remediation code path has ≥1 unit test
- [ ] Wire Playwright into CI

## Idea Brainstorm (not yet scoped)

- [ ] Foolish microtransactions (pay $0.01 to move up a spot)
- [ ] Prizes for absurd, invisible tasks
- [ ] Punishments
- [ ] Absurd sponsors (and possibly real ones among them)
- [ ] Hover banners (ads/text on your own box, viewable by passing neighbors)
- [ ] Clicking boxes ahead of you moves you back two spaces (cumulative)
- [ ] Secret values
- [ ] Visually overwhelming state changes (toasts, flashes, background chaos)
- [ ] Batch-and-blast updates instead of continuous streaming
- [ ] Your number can get called early (random, or via observer pressure)
- [ ] Spot currency earned by waiting, spendable on others' positions

## Recently Done

- [x] Two-tab proof of concept (W1)
- [x] Redis queue + 12s heartbeat eviction (W2)
- [x] Virtual scroll baseline with 120-node DOM pool (needs W3 hardening)
- [x] Range subscription skeleton, mock only (W4 refactor pending)
- [x] Ghost fade baseline (W5 polish pending)
- [x] Winner banner (W5 copy cycling pending)
- [x] Departure counter (W5 rollover test pending)
- [x] Tab title shows position (W5 will switch to seq)
- [x] OG image via Satori (W5 switches to seq, W6 adds cache)
- [x] Dockerfile + Fly.io config (W6 will actually deploy)
- [x] "You won" screen baseline
- [x] P2P neighborhood chat via Trystero (W7 NAT/ICE polish pending)

## Removed from Scope (2026-04-24 reset)

Backend code slated for removal in W7. Documented here so nobody wastes effort reviving.

- User accounts (signup / signin / magic link / OTP)
- Named checkboxes
- Badges
- Follows
- Seasons + superlatives (schema YAML only ever existed)
- 30-minute turn timer / "PUNISHMENT" — never implemented
- Cron / Job Scheduler (was only for seasonal turnover)
