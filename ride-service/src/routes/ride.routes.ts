import { Router } from "express";
import {
  requestRide,
  acceptRide,
  startRide,
  completeRide,
  cancelRide,
  getRideById,
  getRidesByRider,
  getRidesByDriver
} from "../controllers/ride.controller.js";

const router = Router();

router.post("/request", requestRide);
router.patch("/:id/accept", acceptRide);
router.patch("/:id/start", startRide);
router.patch("/:id/complete", completeRide);
router.patch("/:id/cancel", cancelRide);

router.get("/:id", getRideById);
router.get("/rider/:riderId", getRidesByRider);
router.get("/driver/:driverId", getRidesByDriver);

export default router;
