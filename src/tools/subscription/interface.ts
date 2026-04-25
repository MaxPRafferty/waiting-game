export type SubscriptionCallback = (message: string) => void;

export interface ISubscription {
  subscribe(connectionId: string, minSeq: number, maxSeq: number, onMessage: SubscriptionCallback): Promise<void>;
  unsubscribe(connectionId: string): Promise<void>;
  publish(seq: number, message: string): Promise<void>;
}
