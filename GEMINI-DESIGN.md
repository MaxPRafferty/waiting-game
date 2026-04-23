# Gemini Design: The Waiting Game

## Problem Statement

The "Waiting Game" is a massively multiplayer online queue disguised as an impossibly long horizontal strip of checkboxes. When a user joins, they are assigned the last checkbox in a line that can stretch to millions. The core mechanic is simple yet grueling: a user may only check their box if every user ahead of them has either checked their box or left the line. 

If a user closes their connection or fails to send heartbeats, they are evicted, and everyone behind them shifts forward. The application must support a real-time, shared state across an arbitrary number of concurrent connections, rendering a massive list of elements performantly in the browser without overwhelming the DOM.

## What Makes This Cool

The "Waiting Game" transforms patience into a digital spectacle.
- **The Scale:** The concept of being "#500,001 in line" is absurd, yet highly shareable social proof. The number itself is the product.
- **The Spectacle of Attrition:** As users inevitably give up and disconnect, their checkboxes visually "ghost" and fade away, allowing users behind them to visually witness the passage of time and the failure of others.
- **Purposeful Absurdity:** The tone is deadpan, institutional, and indifferent. It does not celebrate waiting; it simply observes it.

## Constraints & Architectural Mandates

### 1. Tri-Layered Backend Architecture
To ensure extreme modularity, the backend is strictly divided into:
- **Tools:** Abstractions for external dependencies (e.g., Queue, Statistics). They must have at least two implementations: `mock` (in-memory) and a live counterpart (e.g., `redis`). The active tool is chosen via the `DEPENDENCY_MODE` environment variable.
- **Workers (Orchestrators):** The core business logic layer. Workers consume Tools via interfaces and orchestrate state changes. They do not touch external libraries directly.
- **Handlers:** The entry points (REST or WebSockets). They validate input, call Workers, and format responses. Handlers map 1:1 to their underlying protocols.

### 2. Protocol & Schema Rigor
- **REST (OpenAPI):** All REST endpoints and their request/response shapes are rigidly defined in `openapi.yaml`.
- **WebSockets (AsyncAPI):** All real-time message payloads are rigidly defined in `asyncapi.yaml`.
- **Shared Schemas:** Both protocols share entity definitions via `schemas.yaml` to prevent structural drift.

### 3. Code Integrity & Standards
- **No Pokemon Catches:** Every `try/catch` must log at least a warning. Silent failures are strictly forbidden (`STANDARDS.md`).
- **Strict Diagnostics:** No feature is committed without passing the `lint`, `typecheck`, and `build:dry` ritual (`AGENTS.md`).
- **Literal Code:** Code modifications must be fully literal. Omission placeholders like `...` are forbidden unless accompanied by a valid code comment explaining the omission.

### 4. Performance
- **Virtual Scrolling:** The frontend must use a fixed DOM pool (currently 120 elements) to render the visible viewport, decoupling DOM size from the total queue length.
- **Redis Sorted Sets:** The core queue must rely on Redis `ZADD`, `ZRANK`, and `ZRANGE` for atomic, high-performance positioning and eligibility checks.

## Visual System: "Vibrant Indifference"

The frontend design language is codified in `VISUAL_SYSTEM.md`:
- **The Void:** An `Eigengrau` (`#16161d`) background provides the canvas.
- **The Palette:** High-contrast, inverted colors. "Mustard of Authority" (`#ffcc00`) and "Indifferent Lavender" (`#cc99ff`) serve as brand accents.
- **Randomized Highlights:** Status messages and announcements pull from defined pools of Positive and Negative colors to add an unsettling, whimsical pop to the otherwise bureaucratic interface.
- **Bloated Scale:** All UI elements are scaled up by 1.4x (checkboxes are 34px wide) to emphasize the gravity of every single position in the endless line.

## Open Questions

- **Horizontal Scaling:** Currently, WebSocket fan-out is handled in memory by a single Node.js process. As concurrent connections scale beyond ~50k, we will need to introduce Redis Pub/Sub to coordinate `range_update` and `position_update` broadcasts across multiple Node.js instances.
- **Server Restart Resilience:** In the current architecture, a server restart drops all WebSocket connections. Because sequence numbers are immutable and tied to sessions, reconnecting clients will lose their place in line. We must decide if we will implement a "grace period" token-recovery system or enforce the cruel reality that a dropped connection is a lost spot.

## Success Criteria

- A user can join the queue and receive an accurate, real-time position number.
- A user can scroll the viewport independently of their position with 60fps performance via the fixed DOM pool.
- When a user ahead of the client leaves, the client's position number decreases, and the departed checkbox visually ghosts out.
- The system can run entirely in-memory (`DEPENDENCY_MODE=MOCK`) for local development, simulating hundreds of thousands of users and background activity.
- The system passes all TypeScript, ESLint, and OpenAPI/AsyncAPI schema validations.

## Distribution Plan

- **Environment:** The application requires a Node.js runtime and a Redis instance (when `DEPENDENCY_MODE=LIVE`).
- **Containerization:** The system will be packaged into a Dockerfile.
- **Hosting:** Targeted for Fly.io or Railway, where the Node.js application and Redis instance can be co-located for low-latency TCP communication.
- **Process Management:** `concurrently` is used for local unified startup (`npm run dev:all`).

---

## Implementation Plan for Remaining Weekends (Next Steps)

### Overview & Current State

The project has successfully completed the foundational weekends (1-3):

- **Weekend 1:** Two-tab Proof of Concept is fully functional.
- **Weekend 2:** Redis sorted set queue and heartbeat liveness are implemented.
- **Weekend 3:** Virtual scroll frontend with a fixed DOM pool and correct relative scrolling is active.
- **Architecture:** The backend has been successfully refactored into a tri-layered structure (Tools, Workers, Handlers) adhering to OpenAPI and AsyncAPI specifications with shared schemas.

The following plan details the step-by-step implementation for the remaining weekends.

---

### Weekend 4: Range Subscriptions (Targeted Fan-out)

**Goal:** Optimize real-time updates. The server currently broadcasts updates (`range_update`, `left`, etc.) to all connected clients. We must implement sequence-based range subscriptions so clients only receive updates for the section of the queue they are actively viewing.

#### Tasks:

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
   - When someone leaves, `position_update` must still go to all clients behind the leaver. Implement an efficient lookup for this using the `Queue` tool to fetch tokens, mapped to connection IDs.

---

### Weekend 5: Persistent Statistics

**Goal:** Implement persistent statistics, specifically the "rage-quit" departure counter, ensuring it correctly tracks daily activity and resets.

#### Tasks:

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

### Weekend 6: Leaderboard & Distribution

**Goal:** Persist winners to a global leaderboard, generate dynamic Open Graph (OG) images for sharing social proof, and finalize deployment configurations.

#### Tasks:

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
