import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import "dotenv/config";
import driverRoutes from "./routes/driver.routes.js";
import { connectProducer, disconnectProducer } from "./kafka/producer.js";
import { connectConsumer, subscribeAndRun, disconnectConsumer } from "./kafka/consumer.js";
import { TOPICS } from "./kafka/topics.js";
import { initKafkaTopics } from "./kafka/kafka.service.js";
import { handleRideEvent } from "./services/ride.service.js";
import { connectRedis, disconnectRedis } from "./lib/redis.js";
import { handleLocationStream } from "./websocket/location.ws.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3002;

// Health Check 
app.get("/health", (_req, res) => {
  res.json({ service: "driver-service", status: "ok" });
});

app.use("/api/drivers", driverRoutes);

const startServer = async () => {
  await connectRedis();

  // Connect Kafka Producer
  await connectProducer();

  // Ensure required Kafka topics exist
  await initKafkaTopics();

  // Connect Kafka Consumer & subscribe to ride.events
  await connectConsumer("driver-service-group");
  await subscribeAndRun(TOPICS.RIDE_EVENTS, async ({ message }) => {
    const raw = message.value?.toString() ?? null;
    await handleRideEvent(raw);
  });

  // Create HTTP server from Express app
  const server = createServer(app);

  // Attach WebSocket server on /location path
  const wss = new WebSocketServer({ server, path: "/location" });

  wss.on("connection", handleLocationStream);

  wss.on("error", (err) => {
    console.error("[WSS] WebSocket server error:", err.message);
  });

  server.listen(PORT, () => {
    console.log(`Driver Service running on port ${PORT}`);
    console.log(`WebSocket server listening on ws://localhost:${PORT}/location`);
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await disconnectConsumer();
    await disconnectProducer();
    await disconnectRedis();

    // Close all WebSocket connections
    wss.clients.forEach((client) => {
      client.close(1001, "Server shutting down");
    });
    wss.close();

    server.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
