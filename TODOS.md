# TODOs

This file reflects the actual state of work and ideas after the 2026-04-24 scope reset. The authoritative weekend-by-weekend plan lives in `DESIGN.md`. Historic claims that were never implemented have been removed or reset.

## Remediation Work (see `DESIGN.md` §7)

### Weekend 3 — Virtual scroll hardening
- [ ] Verify smooth scroll to position #1,000,000
- [ ] Verify rapid-wheel for 10s stays at 120 DOM nodes (no leaks)
- [ ] Verify window resize mid-scroll (pool recomputes, scrollbar scale holds)
- [ ] Extract `CHECKBOX_WIDTH_PX` into a single documented constant

### Weekend 4 — Range subscriptions (Redis implementation)
- [ ] Write `src/tools/subscription/implementations/redis/index.ts`
- [ ] Two-browser integration test for non-overlapping ranges
- [ ] Verify `range_unsubscribe` fires on viewport change (no stale bucket membership)

### Weekend 5 — Leaderboard UI + social polish
- [ ] Leaderboard UI panel (REST `/leaderboard` endpoint already exists)
- [ ] Ghost fade as a CSS transition, not just a `setTimeout` delete
- [ ] Winner banner copy cycling (3–5 phrasings, random pick per event)
- [ ] Verify `getOrdinal` handles the 11/12/13 edge cases
- [ ] Verify `waiting_game:departures:YYYY-MM-DD` rolls over at UTC midnight

### Weekend 6 — Deployment
- [ ] `fly launch` + `fly redis create`, set secrets
- [ ] Acquire a real domain (`waitinggame.lol` or fallback)
- [ ] Production smoke test: two browsers on public URL, full mechanic, OG image renders
- [ ] GitHub Actions workflow: lint + typecheck + `build:dry` on every PR

### Weekend 7 — Scope cleanup + P2P chat polish
- [ ] Delete `src/tools/auth/`
- [ ] Delete `src/tools/storage/`
- [ ] Delete `src/workers/user/` and `src/workers/social/`
- [ ] Remove auth/social REST handlers from `src/handlers/rest/index.ts` and route bindings from `src/routes.ts`
- [ ] Remove `@supabase/supabase-js` dep from `package.json`
- [ ] Remove `Season` + `Superlative` from `schemas.yaml`
- [ ] Remove matching paths from `openapi.yaml`
- [ ] Verify Trystero room switch fires as `scrollOffset` crosses a 100-slot boundary
- [ ] Document NAT/ICE fallback behavior for P2P chat
- [ ] Polish chat UI against the design system from `/design-consultation`

### Weekend 8 — Test harness
- [ ] Install `vitest`
- [ ] `QueueWorker` unit tests against the mock tool
- [ ] `subscription` tool tests (mock + redis) for bucket membership + fan-out
- [ ] One end-to-end test (Playwright or Puppeteer): the two-tab W1 mechanic
- [ ] Wire `npm test` into CI

## Ongoing / UX

- [ ] Copy expansion: static phrases should cycle on refresh; announcements should have wide variety
- [ ] Satisfying "go-fast" scroll animation when jumping to a specific box

## Idea Brainstorm (not yet scoped)

- [ ] Foolish microtransactions (pay $0.01 to move up a spot)
- [ ] Prizes for absurd, invisible tasks
- [ ] Punishments
- [ ] Absurd sponsors (and possibly real ones among them)
- [ ] Hover banners (ads/text on your own box, viewable by passing neighbors)
- [ ] Clicking boxes ahead of you moves you back two spaces (cumulative penalty)
- [ ] Secret values
- [ ] Visually overwhelming state changes (toasts, flashes, background chaos)
- [ ] Batch-and-blast updates instead of continuous streaming
- [ ] Your number can get called early (random, or via observer pressure)
- [ ] Spot currency earned by waiting, spendable on others' positions

## Recently Done

- [x] Two-tab proof of concept (W1)
- [x] Redis queue + 12s heartbeat eviction (W2)
- [x] Virtual scroll baseline with 120-node DOM pool (W3 — needs hardening)
- [x] Range subscription skeleton, mock impl only (W4 — needs Redis impl)
- [x] Ghost fade baseline (W5 — needs animation polish)
- [x] Winner banner (W5 — needs copy cycling)
- [x] Departure counter (W5)
- [x] Tab title shows position (W5)
- [x] OG image generation via Satori (W6)
- [x] Dockerfile + Fly.io config (W6 — not yet deployed publicly)
- [x] "You won" screen baseline
- [x] P2P neighborhood chat via Trystero (out-of-scope add; kept)

## Removed from Scope (2026-04-24 reset)

These were attempted or partially built but are no longer in scope. Remaining backend code is slated for removal in Weekend 7. Documented here so nobody wastes effort reviving them without an explicit scope change.

- User accounts (email/password signup, signin, magic link, OTP)
- Named checkboxes (logged-in users naming their slot)
- Badges
- Follows
- Seasons + superlatives (schema definitions only ever existed)
- 30-minute turn timer / "PUNISHMENT" eviction — **was documented and claimed in commits but never implemented in code**
- Cron/Job Scheduler (was only needed for seasonal turnover)
