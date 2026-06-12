import express from "express";
import "dotenv/config";
import authRoutes from "./routes/auth.routes.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Health Check
app.get("/health", (req, res) => {
  res.json({ service: "user-service", status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});