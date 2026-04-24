# Architecture: The Waiting Game

This document defines the structural constraints and patterns for the Waiting Game backend.

## Environment & Configuration
- Settings are stored in `.env.local`. This file is **not committed**.
- Defaults are stored in `.env.local.defaults`, which **is committed**.
- **`DEPENDENCY_MODE`**: `MOCK` | `LIVE`. Defaults to `MOCK`. Determines if tools use real external dependencies or in-memory mocks.
- **`NODE_ENV`**: `production` | `development`. Defaults to `development`.
- **`BACKEND_TARGET`**: String. Defaults to `local`.

## Backend Structure
The backend is divided into three distinct layers to ensure modularity and dependency injection.

### 1. Tools
A **Tool** is an abstraction for an external dependency or a specific system capability (e.g., Queue, Persistence).
- **Structure**:
  - `interface.ts`: Defines the contract for the tool.
  - `index.ts`: The entry point that selects an implementation based on `DEPENDENCY_MODE`.
  - `implementations/`: A folder containing backing implementations.
    - `mock/`: **Mandatory**. An in-memory implementation for `MOCK` mode.
    - `[dependency_name]/`: e.g., `redis/`. Implementation for `LIVE` mode.
- **Rule**: Tools do not know about orchestrators or handlers.

### 2. Workers (Orchestrators)
Workers contain the core business logic. They "use" one or more Tools to perform complex operations.
- **Rule**: Workers interact with Tools only via their interfaces. They do not interact directly with external dependencies (like the Redis client).

### 3. Handlers
Handlers are the entry points for the system (REST endpoints or WebSocket message types).
- **Rule**: Handlers are 1:1 with the interface they serve.
- **Responsibility**: Validate input, invoke Workers, and transform results into sanitized output.
- **REST (OpenAPI)**: REST validation and return values are defined by an `openapi.yaml` specification. This specification generates the binding of routes to handlers.
- **WebSockets (AsyncAPI)**: WebSocket messages and capabilities are defined by an `asyncapi.yaml` specification. This specification defines the message schemas and generates the binding of message types to handlers in a dedicated `src/handlers/websocket/bindings.ts` (or similar).
- **Shared Schemas**: To avoid duplication, common entities (e.g., `SlotSummary`) MUST be defined in a shared `schemas.yaml` file and referenced by both OpenAPI and AsyncAPI specifications.

## Operational Constraints
- The backend MUST be able to operate entirely without external dependencies when `DEPENDENCY_MODE=MOCK`.

## Current Tool Roster

The active tools after the 2026-04-24 scope reset are `queue`, `subscription`, `leaderboard`, `statistics`, and `imageGenerator`. The `auth` and `storage` tools (previously used for Supabase-backed user accounts) are slated for removal as part of Weekend 7 remediation. See `DESIGN.md` §4 for the authoritative list and §5 for the rationale.
