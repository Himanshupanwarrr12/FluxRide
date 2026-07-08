import express from "express";
import "dotenv/config";
import driverRoutes from "./routes/driver.routes.js";
import { connectKafkaProducer, disconnectKafkaProducer } from "./lib/kafka.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Health Check
app.get("/health", (req, res) => {
  res.json({ service: "driver-service", status: "ok" });
});

// Routes
app.use("/api/drivers", driverRoutes);

const startServer = async () => {
  await connectKafkaProducer();

  const server = app.listen(PORT, () => {
    console.log(`Driver Service running on port ${PORT}`);
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
