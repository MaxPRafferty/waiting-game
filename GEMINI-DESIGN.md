# Gemini Design: Implementation Plan for Remaining Weekends

## Overview & Current State
The project has successfully completed the foundational weekends (1-3):
- **Weekend 1:** Two-tab Proof of Concept is fully functional.
- **Weekend 2:** Redis sorted set queue and heartbeat liveness are implemented.
- **Weekend 3:** Virtual scroll frontend with a fixed DOM pool and correct relative scrolling is active.
- **Architecture:** The backend has been successfully refactored into a tri-layered structure (Tools, Workers, Handlers) adhering to OpenAPI and AsyncAPI specifications with shared schemas.

The following plan details the step-by-step implementation for the remaining weekends as defined in the original `DESIGN.md`, adapted to fit the new modular architecture.

---

## Weekend 4: Range Subscriptions (Targeted Fan-out)

**Goal:** Optimize real-time updates. The server currently broadcasts updates (`range_update`, `left`, etc.) to *all* connected clients. We must implement sequence-based range subscriptions so clients only receive updates for the section of the queue they are actively viewing.

### Tasks:
1. **Create the `Subscription` Tool:**
   - Define `ISubscription` interface with methods: `subscribe(connectionId, minSeq, maxSeq)`, `unsubscribe(connectionId)`, `getSubscribersForBucket(bucketId)`.
   - Implement an in-memory bucketed map for the `MOCK` and `LIVE` environments (subscriptions are process-local).
   - Divide the sequence space into buckets of 1,000 slots (e.g., `bucket = floor(seq / 1000)`).
2. **Refactor `viewport_subscribe` in `QueueWorker` & Handlers:**
   - Update `viewport_subscribe` to map `from_position` and `to_position` to actual sequence numbers using the `Queue` tool.
   - Register the connection ID to the appropriate sequence buckets via the `Subscription` tool.
3. **Implement Targeted Broadcasting:**
   - Refactor `broadcast` in `src/handlers/websocket/bindings.ts` and `index.ts`.
   - Instead of broadcasting to all clients, the server will lookup the bucket for a given mutated sequence number and only push payloads to the connection IDs registered in that bucket.
4. **Update `position_update` Fan-out:**
   - When someone leaves, `position_update` must still go to all clients *behind* the leaver. Implement an efficient lookup for this using the `Queue` tool to fetch tokens, mapped to connection IDs.

---

## Weekend 5: Persistent Statistics

**Goal:** Implement persistent statistics, specifically the "rage-quit" departure counter, ensuring it correctly tracks daily activity and resets.

### Tasks:
1. **Create the `Statistics` Tool:**
   - Define `IStatistics` interface: `incrementDepartures()`, `getDeparturesToday()`.
   - **Redis Implementation:** Use a date-stamped key (e.g., `waiting_game:departures:YYYY-MM-DD`). Use `INCR`. If the value is 1, set an `EXPIRE` of 86400 seconds (24h).
   - **Mock Implementation:** Use an in-memory variable that resets based on the date.
2. **Integrate Statistics into the Worker Layer:**
   - Inject the `Statistics` tool into the `QueueWorker`.
   - Update the `leave` and `cleanup` methods to call `incrementDepartures()` and embed the correct total into the `left` WebSocket message.
3. **Frontend Review:**
   - Verify the frontend correctly displays the daily departure count based on the new persistent backend data.
   - Ensure the ghost checkbox fade-out (30s CSS transition) triggers flawlessly on the targeted `left` messages.

---

## Weekend 6: Leaderboard & Distribution

**Goal:** Persist winners to a global leaderboard, generate dynamic Open Graph (OG) images for sharing social proof, and finalize deployment configurations.

### Tasks:
1. **Create the `Leaderboard` Tool:**
   - Define `ILeaderboard` interface: `addWinner(seq, duration_ms)`, `getTopWinners(limit)`.
   - **Redis Implementation:** Use a Sorted Set `waiting_game:leaderboard` with the timestamp as the score, and the `seq` as the member. Store details in a Hash `waiting_game:winners:{seq}`.
   - **Mock Implementation:** Use an in-memory array.
2. **Implement Leaderboard REST Endpoints:**
   - Update `openapi.yaml` to include a `GET /leaderboard` route.
   - Create `leaderboardHandler` in the REST layer.
   - Update the frontend UI to fetch and display the leaderboard.
3. **Dynamic OG Image Generation:**
   - Add a `GET /og-image/:position` route to `openapi.yaml`.
   - Implement an `ImageGenerator` tool using `satori` (HTML/CSS to SVG) and `@resvg/resvg-js` (SVG to PNG) to generate high-performance, shareable images indicating `#N in line`.
   - Implement the `ogImageHandler` in the REST layer.
4. **Deployment Preparation (Fly.io):**
   - Create a production-ready `Dockerfile`.
   - Create a `fly.toml` configuration file tailored for a unified Node.js + Redis environment.
   - Add final deployment instructions to the `README.md`.
