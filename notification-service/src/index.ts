import express from "express";
import "dotenv/config";
import { connectKafkaConsumer, disconnectKafkaConsumer } from "./lib/kafka.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3005;

app.get("/health", (req, res) => {
  res.json({ service: "notification-service", status: "ok" });
});

const startServer = async () => {
  await connectKafkaConsumer();

  const server = app.listen(PORT, () => {
    console.log(`Notification Service running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await disconnectKafkaConsumer();
    server.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
