import { Router } from "express";
import { processPayment, getPaymentStatus } from "../controllers/payment.controller.js";

const router = Router();

router.post("/process", processPayment);
router.get("/status/:rideId", getPaymentStatus);

export default router;
