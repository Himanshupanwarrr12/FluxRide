import express from "express";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";
import { connectKafkaProducer, disconnectKafkaProducer } from "./services/kafka.service.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Health Check
app.get("/health", (req, res) => {
  res.json({ service: "user-service", status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);

const startServer = async () => {
  await connectKafkaProducer();

  const server = app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await disconnectKafkaProducer();
    server.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();