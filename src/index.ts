import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { QueueStore } from './queue.js';
import type { ClientMessage, ServerMessage } from './types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const CLIENT_DIR = path.join(process.cwd(), 'client');
const PING_INTERVAL_MS = 5_000;
const STALE_THRESHOLD_MS = 12_000;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MOCK_TOTAL_SIZE = 500_000;

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
      position: MOCK_TOTAL_SIZE + queue.getPosition(client.token),
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
  } catch (_err) {
    console.warn(`[handleDeparture] Error terminating socket for seq ${client.seq}:`, _err);
    // Already closed or disconnected
  }

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

      // Tell the new client their place (at the end of the mock line)
      const mockPosition = MOCK_TOTAL_SIZE + queue.getPosition(token);
      send(ws, {
        type: 'joined',
        seq: client.seq,
        position: mockPosition,
      });

      // Send initial range around the user's back-of-line position
      const start = Math.max(0, mockPosition - 30);
      const end = start + 60;
      const currentTotal = MOCK_TOTAL_SIZE + queue.size();
      send(ws, {
        type: 'range_state',
        slots: queue.getRange(start, end, MOCK_TOTAL_SIZE, currentTotal),
        total: currentTotal,
      });

      // Tell all existing clients about the new slot
      broadcast({
        type: 'range_update',
        seq: client.seq,
        position: mockPosition,
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

      const mockPos = MOCK_TOTAL_SIZE + result.position;
      send(ws, { type: 'check_ok', position: mockPos, duration_ms: result.duration_ms });

      // Announce globally
      broadcast({ type: 'winner', seq: result.seq, position: mockPos, duration_ms: result.duration_ms });

      // Update display for all: this slot is now checked
      broadcast({ type: 'range_update', seq: result.seq, position: mockPos, state: 'checked' });

      // The checked user's slot stays in the queue (visible as checked).
      // No position change for anyone else — checked users don't vacate.
      return;
    }

    // --- viewport_subscribe ---
    if (msg.type === 'viewport_subscribe') {
      const currentTotal = MOCK_TOTAL_SIZE + queue.size();
      send(ws, {
        type: 'range_state',
        slots: queue.getRange(msg.from_position, msg.to_position, MOCK_TOTAL_SIZE, currentTotal),
        total: currentTotal,
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

// --- Heartbeat and Mock Activity ---
setInterval(() => {
  const evicted = queue.evictStale(STALE_THRESHOLD_MS);
  for (const client of evicted) {
    departuresTotal++;
    broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
    notifyPositionsBehind(client.seq);
  }

  // --- Mock Activity: Occasionally simulate a phantom checking or leaving ---
  if (Math.random() < 0.2) {
    const mockPos = Math.floor(Math.random() * 50); // Simulate activity near the front
    const mockDuration = Math.floor(Math.random() * 3600_000); // Up to 1h
    
    // Simulate winner announcement
    broadcast({ 
      type: 'winner', 
      seq: -1000 - mockPos, 
      position: mockPos, 
      duration_ms: mockDuration 
    });

    // Simulate range update (checked)
    broadcast({
      type: 'range_update',
      seq: -1000 - mockPos,
      position: mockPos,
      state: 'checked'
    });
  }

  // Random phantom departure
  if (Math.random() < 0.1) {
    const mockPos = Math.floor(Math.random() * (MOCK_TOTAL_SIZE + queue.size()));
    departuresTotal++;
    broadcast({ 
      type: 'left', 
      seq: -1000 - mockPos, 
      departures_today: departuresTotal 
    });
  }

  // Random phantom arrival (new box at the end) - Increased frequency!
  for (let i = 0; i < 2; i++) {
    if (Math.random() < 0.75) {
      const currentTotal = MOCK_TOTAL_SIZE + queue.size();
      broadcast({
        type: 'range_update',
        seq: -2000 - currentTotal - i, // Unique phantom seq
        position: currentTotal,
        state: 'waiting'
      });
    }
  }

}, PING_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`The waiting game is running at http://localhost:${PORT}`);
  console.log(`Contestants: ${queue.size()}`);
});
