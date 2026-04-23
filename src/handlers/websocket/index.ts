import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage, handleDeparture } from './bindings.js';
import { queueWorker } from '../../workers/queue/index.js';
import type { ServerMessage } from '../../types.js';

const tokenToWs = new Map<string, WebSocket>();
const departuresTotal = { value: 0 };

/**
 * Sends a message to all connections subscribed to the bucket containing the given sequence number.
 */
async function broadcastToSubscribers(seq: number, msg: ServerMessage) {
  const subscribers = await queueWorker.getSubscribers(seq);
  for (const token of subscribers) {
    const targetWs = tokenToWs.get(token);
    if (targetWs) targetWs.send(JSON.stringify(msg));
  }
}

/**
 * Sends a message to ALL connected clients.
 */
function broadcastToAll(msg: ServerMessage) {
  for (const targetWs of tokenToWs.values()) {
    targetWs.send(JSON.stringify(msg));
  }
}

/**
 * Notifies all clients behind a given sequence that their position has updated.
 */
async function notifyPositionsBehind(seq: number) {
  const updates = await queueWorker.getPositionsBehind(seq);
  for (const update of updates) {
    const targetWs = tokenToWs.get(update.token);
    if (targetWs) {
      targetWs.send(JSON.stringify({
        type: 'position_update',
        position: update.position,
      }));
    }
  }
}

export const initWebSocket = (wss: WebSocketServer) => {
  wss.on('connection', (ws) => {
    const ctx = {
      token: null as string | null,
      ws,
      tokenToWs,
      departuresTotal
    };

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await handleMessage(msg, ctx);
      } catch (error) {
        console.warn('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      if (ctx.token) {
        await handleDeparture(ctx.token, tokenToWs, departuresTotal);
      }
    });
  });

  // Cleanup and Mock Activity
  setInterval(async () => {
    const evicted = await queueWorker.cleanup();
    for (const client of evicted) {
      departuresTotal.value++;
      tokenToWs.delete(client.token);
      
      const departureMsg: ServerMessage = { type: 'left', seq: client.seq, departures_today: departuresTotal.value };
      await broadcastToSubscribers(client.seq, departureMsg);
      await notifyPositionsBehind(client.seq);
    }

    const activities = await queueWorker.getRandomActivity();
    for (const activity of activities) {
      if (activity.type === 'left') {
        departuresTotal.value++;
        activity.departures_today = departuresTotal.value;
      }
      
      if (activity.type === 'winner') {
        // Winners are global announcements
        broadcastToAll(activity);
      } else if ('seq' in activity) {
        // Range-specific updates (including phantom check results)
        await broadcastToSubscribers(activity.seq, activity);
      }
    }
  }, 5000);
};
