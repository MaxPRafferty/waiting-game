import { WebSocketServer } from 'ws';
import { handleMessage, handleDeparture } from './bindings.js';
import { queueWorker } from '../../workers/queue/index.js';
import type { ServerMessage } from '../../types.js';
import { 
  tokenToWs, 
  broadcastToSubscribers, 
  broadcastToAll, 
  notifyPositionsBehind 
} from './shared.js';

export const initWebSocket = (wss: WebSocketServer) => {
  wss.on('connection', (ws) => {
    const ctx = {
      token: null as string | null,
      ws
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
        await handleDeparture(ctx.token);
      }
    });
  });

  // Cleanup and Mock Activity
  setInterval(async () => {
    const evicted = await queueWorker.cleanup();
    for (const client of evicted) {
      tokenToWs.delete(client.token);
      
      const departureMsg: ServerMessage = { 
        type: 'left', 
        seq: client.seq, 
        departures_today: client.departures_today 
      };
      await broadcastToSubscribers(client.seq, departureMsg);
      await notifyPositionsBehind(client.seq);
    }

    const activities = await queueWorker.getRandomActivity();
    for (const activity of activities) {
      if (activity.type === 'left') {
        // Mock departure handled in worker already incremented stats
        await broadcastToSubscribers(activity.seq, activity);
      } else if (activity.type === 'winner') {
        broadcastToAll(activity);
      } else if ('seq' in activity) {
        await broadcastToSubscribers(activity.seq, activity);
      }
    }
  }, 5000);
};
