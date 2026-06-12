import express from "express";
import "dotenv/config";
import driverRoutes from "./routes/driver.routes.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Health Check
app.get("/health", (req, res) => {
  res.json({ service: "driver-service", status: "ok" });
});

// Routes
app.use("/api/drivers", driverRoutes);

app.listen(PORT, () => {
  console.log(`Driver Service running on port ${PORT}`);
});
