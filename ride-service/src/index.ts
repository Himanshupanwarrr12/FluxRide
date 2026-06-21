import express from "express";
import "dotenv/config";
import rideRoutes from "./routes/ride.routes.js";
import { connectKafkaProducer, disconnectKafkaProducer } from "./lib/kafka.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;

app.get("/health", (req, res) => {
  res.json({ service: "ride-service", status: "ok" });
});

app.use("/api/rides", rideRoutes);

const startServer = async () => {
  await connectKafkaProducer();

  const server = app.listen(PORT, () => {
    console.log(`Ride Service running on port ${PORT}`);
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
