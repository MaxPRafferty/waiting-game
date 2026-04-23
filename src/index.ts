import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { QueueStore } from './queue.js';
import type { ClientMessage, ServerMessage } from './types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const CLIENT_DIR = path.join(process.cwd(), 'client');
const PING_INTERVAL_MS = 5_000;
const STALE_THRESHOLD_MS = 12_000;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// --- Rate limiting ---
const joinRateMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (joinRateMap.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (times.length >= RATE_LIMIT_MAX) {
    joinRateMap.set(ip, times);
    return true;
  }
  times.push(now);
  joinRateMap.set(ip, times);
  return false;
}

// --- State ---
const queue = new QueueStore();
let departuresTotal = 0;

// --- Helpers ---
function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: ServerMessage) {
  for (const client of queue.all()) {
    send(client.ws, msg);
  }
}

function notifyPositionsBehind(seq: number) {
  for (const client of queue.clientsBehind(seq)) {
    send(client.ws, {
      type: 'position_update',
      position: queue.getPosition(client.token),
    });
  }
}

function handleDeparture(token: string) {
  const client = queue.remove(token);
  if (!client) return;

  departuresTotal++;

  // Close the socket if it's still open
  try {
    if (client.ws.readyState === WebSocket.OPEN) client.ws.terminate();
  } catch {}

  broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
  notifyPositionsBehind(client.seq);
}

// --- HTTP server (serves static client files) ---
const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.ico':  'image/x-icon',
};

const httpServer = http.createServer((req, res) => {
  const rawUrl = req.url === '/' ? '/index.html' : (req.url ?? '/index.html');
  // Strip query string
  const urlPath = rawUrl.split('?')[0];
  const filePath = path.join(CLIENT_DIR, urlPath);

  // Prevent path traversal
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] ?? 'application/octet-stream' });
    res.end(data);
  });
});

// --- WebSocket server ---
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
    ?? req.socket.remoteAddress
    ?? 'unknown';

  let token: string | null = null;

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // --- join ---
    if (msg.type === 'join') {
      if (token) return; // already joined on this connection

      if (isRateLimited(ip)) {
        send(ws, { type: 'join_rejected', reason: 'rate_limited' });
        ws.close();
        return;
      }

      if (queue.has(msg.token)) {
        // Reconnect attempt — not supported. New slot.
        // Fall through and assign a new position (token will differ anyway).
      }

      token = msg.token;
      const client = queue.add(token, ws);

      // Tell the new client their place
      send(ws, {
        type: 'joined',
        seq: client.seq,
        position: queue.getPosition(token),
      });

      // Send full queue state to the new client
      send(ws, {
        type: 'range_state',
        slots: queue.allSummaries(),
        total: queue.size(),
      });

      // Tell all existing clients about the new slot
      broadcast({
        type: 'range_update',
        seq: client.seq,
        position: queue.getPosition(token),
        state: 'waiting',
      });

      return;
    }

    if (!token) return;

    // --- ping ---
    if (msg.type === 'ping') {
      queue.touch(token);
      send(ws, { type: 'pong' });
      return;
    }

    // --- check ---
    if (msg.type === 'check') {
      if (msg.token !== token) return;

      const result = queue.check(token);

      if (!result.success) {
        const c = queue.get(token);
        send(ws, {
          type: 'check_rejected',
          reason: c?.checked ? 'already_checked' : 'not_eligible',
        });
        return;
      }

      send(ws, { type: 'check_ok', position: result.position, duration_ms: result.duration_ms });

      // Announce globally
      broadcast({ type: 'winner', seq: result.seq, position: result.position, duration_ms: result.duration_ms });

      // Update display for all: this slot is now checked
      broadcast({ type: 'range_update', seq: result.seq, position: result.position, state: 'checked' });

      // The checked user's slot stays in the queue (visible as checked).
      // No position change for anyone else — checked users don't vacate.
      return;
    }

    // --- viewport_subscribe (ignored in weekend 1 — server always sends full state) ---
    if (msg.type === 'viewport_subscribe') {
      // For weekend 1: just re-send the current full state
      send(ws, {
        type: 'range_state',
        slots: queue.allSummaries(),
        total: queue.size(),
      });
      return;
    }
  });

  ws.on('close', () => {
    if (token) handleDeparture(token);
  });

  ws.on('error', () => {
    if (token) handleDeparture(token);
  });
});

// --- Heartbeat: evict stale connections ---
setInterval(() => {
  const evicted = queue.evictStale(STALE_THRESHOLD_MS);
  for (const client of evicted) {
    departuresTotal++;
    broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
    notifyPositionsBehind(client.seq);
  }
}, PING_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`The waiting game is running at http://localhost:${PORT}`);
  console.log(`Contestants: ${queue.size()}`);
});
