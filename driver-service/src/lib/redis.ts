import { Redis } from "ioredis";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

let redis: Redis;

if (!globalForRedis.redis) {
  globalForRedis.redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  globalForRedis.redis.on("connect", () => {
    console.log("[Redis] Connected");
  });

  globalForRedis.redis.on("error", (err: Error) => {
    console.error("[Redis] Error:", err.message);
  });
}

redis = globalForRedis.redis;

export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
  console.log("[Redis] Disconnected");
};

export { redis };
