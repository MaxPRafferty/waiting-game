import { WebSocket } from 'ws';
import { queueWorker } from '../../workers/queue/index.js';
import type { ServerMessage } from '../../types.js';

export const tokenToWs = new Map<string, WebSocket>();
export const departuresTotal = { value: 0 };

/**
 * Sends a message to a specific connection.
 */
export function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Sends a message to all connections subscribed to the bucket containing the given sequence number.
 */
export async function broadcastToSubscribers(seq: number, msg: ServerMessage) {
  const subscribers = await queueWorker.getSubscribers(seq);
  for (const token of subscribers) {
    const targetWs = tokenToWs.get(token);
    if (targetWs) send(targetWs, msg);
  }
}

/**
 * Sends a message to ALL connected clients.
 */
export function broadcastToAll(msg: ServerMessage) {
  for (const targetWs of tokenToWs.values()) {
    send(targetWs, msg);
  }
}

/**
 * Notifies all clients behind a given sequence that their position has updated.
 */
export async function notifyPositionsBehind(seq: number) {
  const updates = await queueWorker.getPositionsBehind(seq);
  for (const update of updates) {
    const targetWs = tokenToWs.get(update.token);
    if (targetWs) {
      send(targetWs, {
        type: 'position_update',
        position: update.position,
      });
    }
  }
}
