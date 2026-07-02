import express from "express";
import "dotenv/config";
import paymentRoutes from "./routes/payment.routes.js";
import { connectKafkaProducer, connectKafkaConsumer, disconnectKafkaProducer, disconnectKafkaConsumer } from "./lib/kafka.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3004;

app.get("/health", (req, res) => {
  res.json({ service: "payment-service", status: "ok" });
});

app.use("/api/payments", paymentRoutes);

const startServer = async () => {
  await connectKafkaProducer();
  await connectKafkaConsumer();

  const server = app.listen(PORT, () => {
    console.log(`Payment Service running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    await disconnectKafkaConsumer();
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
