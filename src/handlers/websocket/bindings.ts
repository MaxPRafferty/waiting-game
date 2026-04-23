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

/**
 * Sends a message to all connections subscribed to the bucket containing the given sequence number.
 */
async function broadcastToSubscribers(seq: number, msg: ServerMessage, tokenToWs: Map<string, WebSocket>) {
  const subscribers = await queueWorker.getSubscribers(seq);
  for (const token of subscribers) {
    const targetWs = tokenToWs.get(token);
    if (targetWs) targetWs.send(JSON.stringify(msg));
  }
}

/**
 * Sends a message to ALL connected clients.
 */
async function broadcastToAll(msg: ServerMessage, tokenToWs: Map<string, WebSocket>) {
  for (const targetWs of tokenToWs.values()) {
    targetWs.send(JSON.stringify(msg));
  }
}

/**
 * Notifies all clients behind a given sequence that their position has updated.
 */
async function notifyPositionsBehind(seq: number, tokenToWs: Map<string, WebSocket>) {
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

export const handleMessage = async (msg: ClientMessage, ctx: WebSocketContext) => {
  const { ws, tokenToWs } = ctx;

  const send = (m: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(m));
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

      // Automatically subscribe to the range around the user's join position
      const viewport = await queueWorker.subscribe(ctx.token, joinRes.mockPosition - 30, joinRes.mockPosition + 30);
      send({
        type: 'range_state',
        slots: viewport.slots,
        total: viewport.total,
      });

      // Notify others watching this range that a new slot has appeared
      await broadcastToSubscribers(joinRes.client.seq, {
        type: 'range_update',
        seq: joinRes.client.seq,
        position: joinRes.mockPosition,
        state: 'waiting',
      }, tokenToWs);
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
      
      // Winners are global announcements
      await broadcastToAll({ 
        type: 'winner', 
        seq: checkRes.seq, 
        position: checkRes.position, 
        duration_ms: checkRes.duration_ms 
      }, tokenToWs);

      // Notify range subscribers of the state change
      await broadcastToSubscribers(checkRes.seq, { 
        type: 'range_update', 
        seq: checkRes.seq, 
        position: checkRes.position, 
        state: 'checked' 
      }, tokenToWs);
      break;
    }

    case 'viewport_subscribe': {
      if (!ctx.token) return;
      const viewRes = await queueWorker.subscribe(ctx.token, msg.from_position, msg.to_position);
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

  // Notify range subscribers that this slot has departed
  await broadcastToSubscribers(client.seq, { 
    type: 'left', 
    seq: client.seq, 
    departures_today: departuresTotal.value 
  }, tokenToWs);

  // Everyone behind shifts forward
  await notifyPositionsBehind(client.seq, tokenToWs);
};
