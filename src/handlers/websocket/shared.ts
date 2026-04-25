import { WebSocket } from 'ws';
import { queueWorker } from '../../workers/queue/index.js';
import type { ServerMessage } from '../../types.js';

export const tokenToWs = new Map<string, WebSocket>();
export const departuresTotal = { value: 0 };

export function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export async function publishToSubscribers(seq: number, msg: ServerMessage) {
  await queueWorker.publishToSubscribers(seq, msg);
}

export function broadcastToAll(msg: ServerMessage) {
  for (const targetWs of tokenToWs.values()) {
    send(targetWs, msg);
  }
}

export async function notifyPositionsBehind(seq: number) {
  const updates = await queueWorker.getPositionsBehind(seq);
  for (const update of updates) {
    const targetWs = tokenToWs.get(update.token);
    if (targetWs) {
      send(targetWs, {
        type: 'position_update',
        position: update.absolutePosition,
        waiting_position: update.waitingPosition,
      });
    }
  }
}

export function makeSubscriptionCallback(token: string): (message: string) => void {
  return (message: string) => {
    const ws = tokenToWs.get(token);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  };
}
