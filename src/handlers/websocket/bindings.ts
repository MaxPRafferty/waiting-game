import { queueWorker } from '../../workers/queue/index.js';
import type { ClientMessage } from '../../types.js';
import {
  tokenToWs,
  send,
  publishToSubscribers,
  broadcastToAll,
  notifyPositionsBehind,
  makeSubscriptionCallback,
} from './shared.js';

export interface WebSocketContext {
  token: string | null;
  ws: any;
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
        position: joinRes.absolutePosition,
        waiting_position: joinRes.waitingPosition,
      });

      const callback = makeSubscriptionCallback(ctx.token);
      const viewport = await queueWorker.subscribe(ctx.token, joinRes.absolutePosition - 30, joinRes.absolutePosition + 30, callback);
      send(ws, {
        type: 'range_state',
        slots: viewport.slots,
        total: viewport.total,
      });

      await publishToSubscribers(joinRes.client.seq, {
        type: 'range_update',
        seq: joinRes.client.seq,
        position: joinRes.absolutePosition,
        state: 'waiting',
      });
      break;
    }

    case 'ping':
      if (!ctx.token) return;
      await queueWorker.touch(ctx.token);
      send(ws, { type: 'pong' });
      break;

    case 'visibility':
      if (!ctx.token) return;
      await queueWorker.setVisibility(ctx.token, msg.visible);
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

      await publishToSubscribers(checkRes.seq, {
        type: 'range_update',
        seq: checkRes.seq,
        position: checkRes.position,
        state: 'checked'
      });

      await notifyPositionsBehind(checkRes.seq);
      break;
    }

    case 'viewport_subscribe': {
      if (!ctx.token) return;
      const callback = makeSubscriptionCallback(ctx.token);
      const viewRes = await queueWorker.subscribe(ctx.token, msg.from_position, msg.to_position, callback);
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

  await publishToSubscribers(client.seq, {
    type: 'left',
    seq: client.seq,
    departures_today: client.departures_today
  });

  await notifyPositionsBehind(client.seq);
};
