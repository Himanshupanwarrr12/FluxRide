import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  registerDriver,
  addDriverVehicle,
  setAvailability,
  nearbyDrivers,
  getOwnProfile,
  getDriverByIdHandler,
} from "../controllers/driver.controller.js";

const router = Router();

// Protected routes (JWT required)
router.post("/register", authenticate, registerDriver);
router.post("/vehicle", authenticate, addDriverVehicle);
router.put("/availability", authenticate, setAvailability);
router.get("/profile", authenticate, getOwnProfile);

// Public routes
router.get("/nearby", nearbyDrivers);
router.get("/:id", getDriverByIdHandler);

export default router;
