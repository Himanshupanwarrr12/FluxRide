import { Router } from "express";
import { authenticate, requireMode } from "../middlewares/auth.middleware.js";
import {
  registerDriver,
  addDriverVehicle,
  setAvailability,
  nearbyDrivers,
  getOwnProfile,
  getDriverByIdHandler,
  getDriverByUserIdHandler,
} from "../controllers/driver.controller.js";

const router = Router();

// Protected routes (JWT required)
router.post("/register", authenticate, registerDriver);
router.post("/vehicle", authenticate, addDriverVehicle);
router.put("/availability", authenticate, requireMode("DRIVER"), setAvailability);
router.get("/profile", authenticate, requireMode("DRIVER"), getOwnProfile);

// Internal routes (service-to-service, no JWT)
router.get("/internal/user/:userId", getDriverByUserIdHandler);

// Public routes
router.get("/nearby", nearbyDrivers);
router.get("/:id", getDriverByIdHandler);

export default router;
