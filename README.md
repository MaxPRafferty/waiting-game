# The Waiting Game

*Presented without apology.*

There is a line. You are in it.
The line is made of checkboxes.

## What is happening

You have arrived at a webpage containing an indeterminate number of checkboxes and a scrollbar that suggests a scale beyond your immediate comprehension.

1. **Join the Line:** You are automatically assigned a position at the back.
2. **Observe:** You can scroll to see others waiting.
3. **Wait:** You can only check your box when all boxes ahead of you are checked.
4. **Progression:** When the person ahead of you checks their box, the "torch" is passed to you.
5. **Socialize:** Chat with your "checkbox neighborhood" via serverless P2P WebRTC.
6. **Spectacle:** Departed checkboxes visually "ghost" and fade away.
7. **Persistence:** Winners are recorded on a global leaderboard.

## Tech Stack

- **Backend:** Node.js, Express, WebSockets (`ws`)
- **Persistence:** Redis (queue, heartbeats, leaderboard, statistics, range subscriptions)
- **Architecture:** Tri-layered (Tools, Workers, Handlers) with OpenAPI/AsyncAPI specifications — see `ARCHITECTURE.md`
- **Frontend:** Vanilla JS, fixed DOM-pool virtual scrolling, Trystero (P2P chat)

## Local Development

### Prerequisites
- Node.js (v20+)
- Redis (running on `localhost:6379`, or set `REDIS_URL`)

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure environment: `cp .env.local.defaults .env.local`
4. Start the unified development environment: `npm run dev:all`

The server boots in `MOCK` mode by default (in-memory, no external dependencies needed). Set `DEPENDENCY_MODE=LIVE` in `.env.local` to use Redis.

## Deployment

### Docker
The application is containerized and includes all necessary system dependencies and fonts for dynamic image generation.
```bash
docker build -t waiting-game .
docker run -p 3000:3000 waiting-game
```

### Fly.io
1. Create a Fly app: `fly launch`
2. Provision a Redis instance: `fly redis create`
3. Set the `REDIS_URL` secret.
4. Deploy: `fly deploy`

## Project Docs

- **`DESIGN.md`** — current source of truth. Vision, architecture, weekend-by-weekend remediation plan.
- **`DESIGN-ORIGINAL.md`** — original plan (historic, preserved unmodified).
- **`GEMINI-DESIGN.md`** — intermediate plan from a prior iteration (historic, scope has since been reset).
- **`ARCHITECTURE.md`** — tri-layered structure and schema-first design rules.
- **`STANDARDS.md`** — error-handling and naming conventions.
- **`VISUAL_SYSTEM.md`** — "Vibrant Indifference" design language (to be expanded via `/design-consultation`).
- **`AGENTS.md`** — mandatory diagnostic rituals.
- **`TODOS.md`** — current gaps, ongoing UX work, idea brainstorm, and items removed from scope.
