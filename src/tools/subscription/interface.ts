export interface ISubscription {
  /**
   * Subscribes a connection to a range of sequence numbers.
   * Maps the connection to one or more buckets of 1,000 slots.
   */
  subscribe(connectionId: string, minSeq: number, maxSeq: number): Promise<void>;

  /**
   * Removes all subscriptions for a given connection.
   */
  unsubscribe(connectionId: string): Promise<void>;

  /**
   * Returns a set of connection IDs subscribed to the bucket containing the given sequence number.
   */
  getSubscribers(seq: number): Promise<Set<string>>;
}
