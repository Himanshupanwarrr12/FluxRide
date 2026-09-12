import express from "express";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { connectDatabase } from "./lib/prisma.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Health Check
let dbConnected = false;
app.get("/health", (req, res) => {
  res.json({ service: "user-service", status: "ok", database: dbConnected ? "connected" : "disconnected" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

const startServer = async () => {
  // Connect PostgreSQL
  await connectDatabase();
  dbConnected = true;

  const server = app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    server.close(() => {
      console.log("Closed out remaining connections");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
