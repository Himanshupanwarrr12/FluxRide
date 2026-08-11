import { createClient } from "redis";

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL environment is not set");
}

let redis: ReturnType<typeof createClient>;

if (process.env.NODE_ENV === "production") {
  redis = createClient({ url: redisUrl });
} else {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createClient({ url: redisUrl });
  }
  redis = globalForRedis.redis;
}

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Connect immediately — all callers await this client
await redis.connect();

// Graceful shutdown
process.on("beforeExit", async () => {
  await redis.disconnect();
});

export { redis };
