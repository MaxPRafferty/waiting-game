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
- **OpenAPI**: REST validation and return values are defined by an OpenAPI specification. This specification generates the binding of routes to handlers consumed at startup.

## Operational Constraints
- The backend MUST be able to operate entirely without external dependencies when `DEPENDENCY_MODE=MOCK`.
