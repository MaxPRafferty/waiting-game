import { WebSocket, WebSocketServer } from 'ws';
import { queueWorker } from '../../workers/queue/index.js';
import type { ClientMessage, ServerMessage } from '../../types.js';

const tokenToWs = new Map<string, WebSocket>();
let departuresTotal = 0;

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function broadcast(msg: ServerMessage) {
  const clients = await queueWorker.getPositionsBehind(-1); // Get all
  for (const client of clients) {
    const ws = tokenToWs.get(client.token);
    if (ws) send(ws, msg);
  }
}

async function notifyPositionsBehind(seq: number) {
  const updates = await queueWorker.getPositionsBehind(seq);
  for (const update of updates) {
    const ws = tokenToWs.get(update.token);
    if (ws) {
      send(ws, {
        type: 'position_update',
        position: update.position,
      });
    }
  }
}

async function handleDeparture(token: string) {
  const client = await queueWorker.leave(token);
  if (!client) return;

  departuresTotal++;
  tokenToWs.delete(token);

  broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
  await notifyPositionsBehind(client.seq);
}

export const initWebSocket = (wss: WebSocketServer) => {
  wss.on('connection', (ws) => {
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
        token = msg.token;
        tokenToWs.set(token, ws);
        
        const result = await queueWorker.join(token);
        send(ws, {
          type: 'joined',
          seq: result.client.seq,
          position: result.mockPosition,
        });

        const viewport = await queueWorker.getViewport(result.mockPosition - 30, result.mockPosition + 30);
        send(ws, {
          type: 'range_state',
          slots: viewport.slots,
          total: viewport.total,
        });

        broadcast({
          type: 'range_update',
          seq: result.client.seq,
          position: result.mockPosition,
          state: 'waiting',
        });
        return;
      }

      if (!token) return;

      if (msg.type === 'ping') {
        await queueWorker.touch(token);
        send(ws, { type: 'pong' });
        return;
      }

      if (msg.type === 'check') {
        const result = await queueWorker.check(token);
        if (!result.success) {
          send(ws, { type: 'check_rejected', reason: 'not_eligible' }); // Simplified for now
          return;
        }
        send(ws, { type: 'check_ok', position: result.position, duration_ms: result.duration_ms });
        broadcast({ type: 'winner', seq: result.seq, position: result.position, duration_ms: result.duration_ms });
        broadcast({ type: 'range_update', seq: result.seq, position: result.position, state: 'checked' });
        return;
      }

      if (msg.type === 'viewport_subscribe') {
        const viewport = await queueWorker.getViewport(msg.from_position, msg.to_position);
        send(ws, {
          type: 'range_state',
          slots: viewport.slots,
          total: viewport.total,
        });
        return;
      }
    });

    ws.on('close', () => {
      if (token) handleDeparture(token);
    });
  });

  // Cleanup and Mock Activity
  setInterval(async () => {
    const evicted = await queueWorker.cleanup();
    for (const client of evicted) {
      departuresTotal++;
      tokenToWs.delete(client.token);
      broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal });
      await notifyPositionsBehind(client.seq);
    }

    const activities = await queueWorker.getRandomActivity();
    for (const activity of activities) {
      if (activity.type === 'left') {
        departuresTotal++;
        activity.departures_today = departuresTotal;
      }
      broadcast(activity);
    }
  }, 5000);
};
