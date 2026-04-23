import { WebSocket } from 'ws';
import { queueWorker } from '../../workers/queue/index.js';
import type { ClientMessage, ServerMessage } from '../../types.js';

// In a real production system, this would be generated from asyncapi.yaml
// For now, we manually bind message types to worker calls.

export interface WebSocketContext {
  token: string | null;
  ws: WebSocket;
  tokenToWs: Map<string, WebSocket>;
  departuresTotal: { value: number };
}

export const handleMessage = async (msg: ClientMessage, ctx: WebSocketContext) => {
  const { ws, tokenToWs } = ctx;

  const send = (m: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(m));
    }
  };

  const broadcast = async (m: ServerMessage) => {
    const clients = await queueWorker.getPositionsBehind(-1);
    for (const client of clients) {
      const targetWs = tokenToWs.get(client.token);
      if (targetWs) targetWs.send(JSON.stringify(m));
    }
  };

  switch (msg.type) {
    case 'join': {
      if (ctx.token) return;
      ctx.token = msg.token;
      tokenToWs.set(ctx.token, ws);
      
      const joinRes = await queueWorker.join(ctx.token);
      send({
        type: 'joined',
        seq: joinRes.client.seq,
        position: joinRes.mockPosition,
      });

      const viewport = await queueWorker.getViewport(joinRes.mockPosition - 30, joinRes.mockPosition + 30);
      send({
        type: 'range_state',
        slots: viewport.slots,
        total: viewport.total,
      });

      broadcast({
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
      send({ type: 'pong' });
      break;

    case 'check': {
      if (!ctx.token) return;
      const checkRes = await queueWorker.check(ctx.token);
      if (!checkRes.success) {
        send({ type: 'check_rejected', reason: 'not_eligible' });
        return;
      }
      send({ type: 'check_ok', position: checkRes.position, duration_ms: checkRes.duration_ms });
      broadcast({ type: 'winner', seq: checkRes.seq, position: checkRes.position, duration_ms: checkRes.duration_ms });
      broadcast({ type: 'range_update', seq: checkRes.seq, position: checkRes.position, state: 'checked' });
      break;
    }

    case 'viewport_subscribe': {
      if (!ctx.token) return;
      const viewRes = await queueWorker.getViewport(msg.from_position, msg.to_position);
      send({
        type: 'range_state',
        slots: viewRes.slots,
        total: viewRes.total,
      });
      break;
    }
  }
};

export const handleDeparture = async (token: string, tokenToWs: Map<string, WebSocket>, departuresTotal: { value: number }) => {
  const client = await queueWorker.leave(token);
  if (!client) return;

  departuresTotal.value++;
  tokenToWs.delete(token);

  const broadcast = async (m: ServerMessage) => {
    const clients = await queueWorker.getPositionsBehind(-1);
    for (const c of clients) {
      const targetWs = tokenToWs.get(c.token);
      if (targetWs) targetWs.send(JSON.stringify(m));
    }
  };

  const notifyPositionsBehind = async (seq: number) => {
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
  };

  await broadcast({ type: 'left', seq: client.seq, departures_today: departuresTotal.value });
  await notifyPositionsBehind(client.seq);
};
