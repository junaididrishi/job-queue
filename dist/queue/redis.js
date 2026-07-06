"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriberClient = exports.redisClient = void 0;
exports.connectRedis = connectRedis;
exports.connectSubscriber = connectSubscriber;
exports.disconnectRedis = disconnectRedis;
const redis_1 = require("redis");
const config_1 = require("../config");
const redisClient = (0, redis_1.createClient)({ url: config_1.config.redis.url });
exports.redisClient = redisClient;
const subscriberClient = (0, redis_1.createClient)({ url: config_1.config.redis.url });
exports.subscriberClient = subscriberClient;
redisClient.on('error', (err) => console.error('[Redis] Client error:', err));
subscriberClient.on('error', (err) => console.error('[Redis] Subscriber error:', err));
async function connectRedis() {
    if (!redisClient.isOpen)
        await redisClient.connect();
    console.log('[Redis] Connected');
}
async function connectSubscriber() {
    if (!subscriberClient.isOpen)
        await subscriberClient.connect();
}
async function disconnectRedis() {
    if (redisClient.isOpen)
        await redisClient.disconnect();
    if (subscriberClient.isOpen)
        await subscriberClient.disconnect();
}
//# sourceMappingURL=redis.js.map