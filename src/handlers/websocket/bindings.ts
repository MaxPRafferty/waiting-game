import { WebSocket } from 'ws';
import { queueWorker } from '../../workers/queue/index.js';
import type { ClientMessage } from '../../types.js';
import { 
  tokenToWs, 
  send, 
  broadcastToSubscribers, 
  broadcastToAll, 
  notifyPositionsBehind 
} from './shared.js';

export interface WebSocketContext {
  token: string | null;
  ws: WebSocket;
}

export const handleMessage = async (msg: ClientMessage, ctx: WebSocketContext) => {
  const { ws } = ctx;

  switch (msg.type) {
    case 'join': {
      if (ctx.token) return;
      ctx.token = msg.token;
      tokenToWs.set(ctx.token, ws);
      
      const joinRes = await queueWorker.join(ctx.token);
      send(ws, {
        type: 'joined',
        seq: joinRes.client.seq,
        position: joinRes.mockPosition,
      });

      const viewport = await queueWorker.subscribe(ctx.token, joinRes.mockPosition - 30, joinRes.mockPosition + 30);
      send(ws, {
        type: 'range_state',
        slots: viewport.slots,
        total: viewport.total,
      });

      await broadcastToSubscribers(joinRes.client.seq, {
        type: 'range_update',
        seq: joinRes.client.seq,
        position: joinRes.mockPosition,
        state: 'waiting',
      });
      break;
    }

    case 'ping':
      if (!ctx.token) return;
      await queueWorker.touch(ctx.token);
      send(ws, { type: 'pong' });
      break;

    case 'check': {
      if (!ctx.token) return;
      const checkRes = await queueWorker.check(ctx.token);
      if (!checkRes.success) {
        send(ws, { type: 'check_rejected', reason: 'not_eligible' });
        return;
      }
      send(ws, { type: 'check_ok', position: checkRes.position, duration_ms: checkRes.duration_ms });
      
      await broadcastToAll({ 
        type: 'winner', 
        seq: checkRes.seq, 
        position: checkRes.position, 
        duration_ms: checkRes.duration_ms 
      });

      await broadcastToSubscribers(checkRes.seq, { 
        type: 'range_update', 
        seq: checkRes.seq, 
        position: checkRes.position, 
        state: 'checked' 
      });
      break;
    }

    case 'viewport_subscribe': {
      if (!ctx.token) return;
      const viewRes = await queueWorker.subscribe(ctx.token, msg.from_position, msg.to_position);
      send(ws, {
        type: 'range_state',
        slots: viewRes.slots,
        total: viewRes.total,
      });
      break;
    }
  }
};

export const handleDeparture = async (token: string) => {
  const client = await queueWorker.leave(token);
  if (!client) return;

  tokenToWs.delete(token);

  await broadcastToSubscribers(client.seq, { 
    type: 'left', 
    seq: client.seq, 
    departures_today: client.departures_today 
  });

  await notifyPositionsBehind(client.seq);
};
