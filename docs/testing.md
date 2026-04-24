# Testing

Every new code path ships with a test.

## Running Tests

```bash
npm test          # single run
npm run test:watch # watch mode
```

## Stack

- **Runner:** [Vitest](https://vitest.dev/) — fast, TypeScript-native, zero config beyond `vitest.config.ts`.
- **Assertions:** Vitest built-in `expect` (Chai-compatible).
- **Mocking:** `vi.mock()` for module-level tool singletons; direct mock class instantiation for isolation.

## Structure

```
test/
  queue-worker.test.ts    # QueueWorker unit tests against mock tools
```

Tests live in `test/` at the project root, not alongside source files.

## Writing Tests

### Unit tests against mock tools

The backend uses a tri-layered architecture (Tools → Workers → Handlers). Workers depend on Tool singletons resolved at import time via `DEPENDENCY_MODE`. Tests mock these singletons using `vi.mock()` and inject fresh mock implementations per test via `beforeEach`.

Pattern:

```ts
vi.mock('../src/tools/queue/index.js', () => {
  const q = new MockQueue();
  return { queue: q };
});

// In beforeEach, replace the singleton with a fresh instance:
const mod = await import('../src/tools/queue/index.js') as any;
mod.queue = new MockQueue();
```

This gives each test a clean slate without needing to reset internal state.

### What to test

- **Workers:** Business logic and orchestration across tools. Test via mock tool implementations.
- **Tools (mock):** Correctness of in-memory implementations against the interface contract.
- **Handlers:** Input validation and response shaping (future — W8 E2E via Playwright).

### What not to test

- Redis implementations in unit tests (those are integration tests, gated on `DEPENDENCY_MODE=LIVE`).
- `getRandomActivity()` mock traffic generator — it's dev-only simulation.
