import type { SlotSummary } from '../../types.js';

export interface QueueClient {
  seq: number;
  token: string;
  checked: boolean;
  joined_at: number;
  last_ping: number;
  is_visible: boolean;
}

export interface IQueue {
  add(token: string): Promise<QueueClient>;
  remove(token: string): Promise<QueueClient | null>;
  get(token: string): Promise<QueueClient | null>;
  getPosition(token: string): Promise<number>;
  getWaitingPosition(token: string): Promise<number>;
  isEligible(token: string): Promise<boolean>;
  check(token: string): Promise<{ success: boolean; seq: number; position: number; duration_ms: number }>;
  getRange(fromPos: number, toPos: number, offset: number, total: number): Promise<SlotSummary[]>;
  size(): Promise<number>;
  getAllRealClients(): Promise<{token: string, seq: number}[]>;
  touch(token: string): Promise<void>;
  setVisibility(token: string, visible: boolean): Promise<void>;
  evictStale(thresholdMs: number): Promise<QueueClient[]>;
  getPositionSnapshot(): Promise<Array<{token: string, absolutePosition: number, waitingPosition: number}>>;
}
