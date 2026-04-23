import { WebSocketServer, WebSocket } from 'ws';
import { handleMessage, handleDeparture } from './bindings.js';
import { queueWorker } from '../../workers/queue/index.js';
import type { ServerMessage } from '../../types.js';

const tokenToWs = new Map<string, WebSocket>();
const departuresTotal = { value: 0 };

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
        console.error('WebSocket message error:', error);
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
      const broadcast = async (m: ServerMessage) => {
        const clients = await queueWorker.getPositionsBehind(-1);
        for (const c of clients) {
          const targetWs = tokenToWs.get(c.token);
          if (targetWs) targetWs.send(JSON.stringify(m));
        }
      };
      await broadcast(departureMsg);

      const updates = await queueWorker.getPositionsBehind(client.seq);
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

    const activities = await queueWorker.getRandomActivity();
    for (const activity of activities) {
      if (activity.type === 'left') {
        departuresTotal.value++;
        activity.departures_today = departuresTotal.value;
      }
      const clients = await queueWorker.getPositionsBehind(-1);
      for (const c of clients) {
        const targetWs = tokenToWs.get(c.token);
        if (targetWs) targetWs.send(JSON.stringify(activity));
      }
    }
  }, 5000);
};
