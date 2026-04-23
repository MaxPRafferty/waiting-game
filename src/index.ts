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
const tokenToWs = new Map<string, WebSocket>();
let departuresTotal = 0;

// --- Helpers ---
function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function broadcast(msg: ServerMessage) {
  const clients = await queue.getAllRealClients();
  for (const client of clients) {
    const ws = tokenToWs.get(client.token);
    if (ws) send(ws, msg);
  }
}

async function notifyPositionsBehind(_seq: number) {
  const clients = await queue.getAllRealClients();
  for (const client of clients) {
    const pos = await queue.getPosition(client.token);
    const mockPos = MOCK_TOTAL_SIZE + pos;
    const ws = tokenToWs.get(client.token);
    if (ws) {
      send(ws, {
        type: 'position_update',
        position: mockPos,
      });
    }
  }
}

async function handleDeparture(token: string) {
  const client = await queue.remove(token);
  if (!client) return;

  departuresTotal++;
  tokenToWs.delete(token);

  // Note: we don't terminate the socket here as this is usually called FROM the socket close handler
  broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
  await notifyPositionsBehind(client.seq);
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
  const urlPath = rawUrl.split('?')[0];
  const filePath = path.join(CLIENT_DIR, urlPath);

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

  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join') {
      if (token) return;
      if (isRateLimited(ip)) {
        send(ws, { type: 'join_rejected', reason: 'rate_limited' });
        ws.close();
        return;
      }

      token = msg.token;
      tokenToWs.set(token, ws);
      const client = await queue.add(token);

      const pos = await queue.getPosition(token);
      const mockPosition = MOCK_TOTAL_SIZE + pos;
      send(ws, {
        type: 'joined',
        seq: client.seq,
        position: mockPosition,
      });

      const start = Math.max(0, mockPosition - 30);
      const end = start + 60;
      const size = await queue.size();
      const currentTotal = MOCK_TOTAL_SIZE + size;
      send(ws, {
        type: 'range_state',
        slots: await queue.getRange(start, end, MOCK_TOTAL_SIZE, currentTotal),
        total: currentTotal,
      });

      broadcast({
        type: 'range_update',
        seq: client.seq,
        position: mockPosition,
        state: 'waiting',
      });

      return;
    }

    if (!token) return;

    if (msg.type === 'ping') {
      await queue.touch(token);
      send(ws, { type: 'pong' });
      return;
    }

    if (msg.type === 'check') {
      if (msg.token !== token) return;
      const result = await queue.check(token);

      if (!result.success) {
        const c = await queue.get(token);
        send(ws, {
          type: 'check_rejected',
          reason: c?.checked ? 'already_checked' : 'not_eligible',
        });
        return;
      }

      const mockPos = MOCK_TOTAL_SIZE + result.position;
      send(ws, { type: 'check_ok', position: mockPos, duration_ms: result.duration_ms });
      broadcast({ type: 'winner', seq: result.seq, position: mockPos, duration_ms: result.duration_ms });
      broadcast({ type: 'range_update', seq: result.seq, position: mockPos, state: 'checked' });
      return;
    }

    if (msg.type === 'viewport_subscribe') {
      const size = await queue.size();
      const currentTotal = MOCK_TOTAL_SIZE + size;
      send(ws, {
        type: 'range_state',
        slots: await queue.getRange(msg.from_position, msg.to_position, MOCK_TOTAL_SIZE, currentTotal),
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
setInterval(async () => {
  // --- Evict stale connections ---
  const evicted = await queue.evictStale(STALE_THRESHOLD_MS);
  for (const client of evicted) {
    departuresTotal++;
    tokenToWs.delete(client.token);
    
    // Broadcast departure and notify positions behind
    broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
    await notifyPositionsBehind(client.seq);
  }

  if (Math.random() < 0.2) {
    const mockPos = Math.floor(Math.random() * 50);
    const mockDuration = Math.floor(Math.random() * 3600_000);
    
    broadcast({ 
      type: 'winner', 
      seq: -1000 - mockPos, 
      position: mockPos, 
      duration_ms: mockDuration 
    });

    broadcast({
      type: 'range_update',
      seq: -1000 - mockPos,
      position: mockPos,
      state: 'checked'
    });
  }

  if (Math.random() < 0.1) {
    const size = await queue.size();
    const mockPos = Math.floor(Math.random() * (MOCK_TOTAL_SIZE + size));
    departuresTotal++;
    broadcast({ 
      type: 'left', 
      seq: -1000 - mockPos, 
      departures_today: departuresTotal 
    });
  }

  for (let i = 0; i < 2; i++) {
    if (Math.random() < 0.75) {
      const size = await queue.size();
      const currentTotal = MOCK_TOTAL_SIZE + size;
      broadcast({
        type: 'range_update',
        seq: -2000 - currentTotal - i,
        position: currentTotal,
        state: 'waiting'
      });
    }
  }
}, PING_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`The waiting game (Redis Edition) is running at http://localhost:${PORT}`);
});
