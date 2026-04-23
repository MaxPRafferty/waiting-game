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
- **Tools:** Abstractions for external dependencies (e.g., Queue, Statistics). They must have at least two implementations: `mock` (in-memory) and a live counterpart (e.g., `redis` or `supabase`). The active tool is chosen via the `DEPENDENCY_MODE` environment variable.
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
- **Targeted Fan-out:** The server uses sequence-based range subscriptions. Clients only receive updates for the "neighborhood" (1,000 slots) they are currently viewing.
- **Redis Sorted Sets:** The core queue relies on Redis `ZADD`, `ZRANK`, and `ZRANGE` for atomic, high-performance positioning and eligibility checks.

## Social Mechanics

### 1. P2P Neighborhood Chat
Implemented via **Trystero** (WebRTC over BitTorrent trackers). 
- **Zero Server Load:** Chat data never touches the backend.
- **Contextual Presence:** Users are dynamically joined to rooms based on their `scrollOffset` (neighborhoods of 100 checkboxes).
- **Ephemeral:** Messages exist only in memory for active peers.

### 2. The Waiting Line (Progression)
- **Starting vs. Current Position:** The system tracks both the user's initial join position and their active place in the un-checked line.
- **The Torch:** When a user checks their box, they remain in the viewport as "checked," but the active waiting line moves forward, granting eligibility to the next person in line.
- **The Turn Timer:** When a user reaches the front (#1), a 30-minute countdown begins. Failure to check the box within this window results in immediate eviction ("PUNISHMENT").

## Inferred Database Schema (Supabase/Storage Tool)

- **`users`**: `id`, `username`, `email`, `created_at`.
- **`named_checkboxes`**: `id`, `user_id`, `token`, `name`, `is_active`, `created_at`.
- **`badges`**: `id`, `name`, `description`, `image_url`.
- **`user_badges`**: `user_id`, `badge_id`, `awarded_at`.
- **`follows`**: `user_id`, `target_token`, `target_name`, `created_at`.
- **`seasons`**: `id`, `name`, `start_at`, `end_at`.
- **`superlatives`**: `id`, `name`, `description`.
- **`season_superlatives`**: `season_id`, `superlative_id`, `user_id`, `awarded_at`.

---

## Completed Phases

### Weekends 1-3: Foundations
- [x] Two-tab Proof of Concept.
- [x] Redis sorted set queue and heartbeat liveness.
- [x] Virtual scroll frontend with fixed DOM pool.
- [x] Tri-layered architecture refactor.

### Weekend 4: Range Subscriptions
- [x] Create Subscription Tool (bucketed fan-out).
- [x] Targeted WebSocket broadcasts.

### Weekend 5: Persistent Statistics
- [x] Statistics Tool (Redis with daily expiry).
- [x] Persistent daily departure counter.

### Weekend 6: Leaderboard & Distribution
- [x] Leaderboard Tool (Redis Sorted Set).
- [x] Dynamic OG Image generation (Satori + Resvg).
- [x] Docker & Fly.io configuration.
- [x] Comprehensive documentation overhaul.

### Weekend 7: User Accounts & Social (Backend)
- [x] Auth Tool (Supabase/Mock) with Magic Link/OTP.
- [x] User, Badge, and Follow Workers.
- [x] REST endpoints for all account actions.
- [x] P2P Neighborhood Chat (exclusively frontend).
- [x] Turn Timer (Frontend logic & UI).
- [x] Database Schema for Seasons and Superlatives.

---

## Implementation Plan for Remaining Weekends (Next Steps)

### Weekend 8: UI Integration & Polishing
**Goal:** Expose the new account and social features to the user via a polished frontend.

1. **Auth UI:**
   - Create a drawer or modal for Signup/Signin.
   - Implement "Magic Link" and "OTP" flows in the UI.
   - Show User Profile (badges, username) in the header.
2. **Social UI:**
   - Add "Follow" button to the chat or when clicking a checkbox.
   - Implement a "Following" panel to quickly scroll to followed tokens.
3. **Leaderboard UI:**
   - Add a sliding panel to display recent winners and their wait times.
4. **Visual Polish:**
   - Add satisfying animations for position shifts.
   - Refine the "You Won" state with celebratory (but indifferent) flourishes.
