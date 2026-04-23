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
5. **The Clock:** Once you reach the front (#1), you have 30 minutes to check your box or be evicted.
6. **Socialize:** Chat with your "checkbox neighborhood" via serverless P2P WebRTC.
7. **Enshrine:** Create an account to name your checkbox and earn badges across seasons.
8. **Spectacle:** Departed checkboxes visually "ghost" and fade away.
9. **Persistence:** Winners are recorded on a global leaderboard.

## Tech Stack
- **Backend:** Node.js, Express, WebSockets (`ws`).
- **Persistence:** Redis (Queue/Heartbeats) & Supabase (Auth/Storage).
- **Architecture:** Tri-layered (Tools, Workers, Handlers) with OpenAPI/AsyncAPI specifications.
- **Frontend:** Vanilla JS, Fixed DOM Pool Virtual Scrolling, Trystero (P2P Chat).

## Local Development

### Prerequisites
- Node.js (v20+)
- Redis (running on `localhost:6379`)
- Supabase Project (for live mode)

### Setup
1. Clone the repository.
2. Install dependencies: `npm install`
3. Configure environment: `cp .env.local.defaults .env.local`
4. Start the unified development environment: `npm run dev:all`

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
3. Set the `REDIS_URL`, `SUPABASE_URL`, and `SUPABASE_KEY` secrets.
4. Deploy: `fly deploy`

## Code Standards
This project follows strict engineering standards defined in:
- `ARCHITECTURE.md`: Tri-layered structure and schema-first design.
- `STANDARDS.md`: Error handling and naming conventions.
- `VISUAL_SYSTEM.md`: "Vibrant Indifference" design language.
- `AGENTS.md`: Mandatory diagnostic rituals.
