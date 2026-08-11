import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  registerDriver,
  addDriverVehicle,
  setAvailability,
  updateLocation,
  nearbyDrivers,
  getOwnProfile,
  getDriverByIdHandler,
} from "../controllers/driver.controller.js";

const router = Router();

// Public routes
router.get("/nearby", nearbyDrivers);
router.get("/:id", getDriverByIdHandler);

// Protected routes (JWT required)
router.post("/register", authenticate, registerDriver);
router.post("/vehicle", authenticate, addDriverVehicle);
router.put("/availability", authenticate, setAvailability);
router.put("/location", authenticate, updateLocation);
router.get("/profile", authenticate, getOwnProfile);

export default router;
