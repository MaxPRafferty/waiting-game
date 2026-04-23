import { InMemorySubscription } from './implementations/mock/index.js';
import type { ISubscription } from './interface.js';

// Subscriptions are currently process-local (v1).
// In v2, this might be backed by Redis Pub/Sub for horizontal scaling.
export const subscription: ISubscription = new InMemorySubscription();
