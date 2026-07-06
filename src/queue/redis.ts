import { createClient } from 'redis';
import { config } from '../config';

const redisClient = createClient({ url: config.redis.url });
const subscriberClient = createClient({ url: config.redis.url });

redisClient.on('error', (err) => console.error('[Redis] Client error:', err));
subscriberClient.on('error', (err) => console.error('[Redis] Subscriber error:', err));

export async function connectRedis() {
  if (!redisClient.isOpen) await redisClient.connect();
  console.log('[Redis] Connected');
}

export async function connectSubscriber() {
  if (!subscriberClient.isOpen) await subscriberClient.connect();
}

export async function disconnectRedis() {
  if (redisClient.isOpen) await redisClient.disconnect();
  if (subscriberClient.isOpen) await subscriberClient.disconnect();
}

export { redisClient, subscriberClient };
