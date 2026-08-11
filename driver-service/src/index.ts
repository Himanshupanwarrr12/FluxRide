import express from "express";
import "dotenv/config";
import driverRoutes from "./routes/driver.routes.js";
import { connectProducer, disconnectProducer } from "./kafka/producer.js";
import { connectConsumer, subscribeAndRun, disconnectConsumer } from "./kafka/consumer.js";
import { TOPICS } from "./kafka/topics.js";
import { handleRideEvent } from "./services/ride.service.js";
import { connectRedis, disconnectRedis } from "./lib/redis.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3002;

// Health Check
app.get("/health", (_req, res) => {
  res.json({ service: "driver-service", status: "ok" });
});

// Routes
app.use("/api/drivers", driverRoutes);

const startServer = async () => {
  // Connect Redis
  await connectRedis();

  // Connect Kafka Producer
  await connectProducer();

  // Connect Kafka Consumer & subscribe to ride.events
  await connectConsumer("driver-service-group");
  await subscribeAndRun(TOPICS.RIDE_EVENTS, async ({ message }) => {
    const raw = message.value?.toString() ?? null;
    await handleRideEvent(raw);
  });

  const server = app.listen(PORT, () => {
    console.log(`Driver Service running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await disconnectConsumer();
    await disconnectProducer();
    await disconnectRedis();
    server.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
