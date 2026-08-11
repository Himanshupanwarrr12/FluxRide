import { Router } from "express";
import {
  requestOtpHandler,
  verifyOtpHandler,
  completeSignupHandler,
  requestAddContactHandler,
  verifyAddContactHandler,
  refresh,
  logout,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// OTP flow (public)
router.post("/otp/request", requestOtpHandler);
router.post("/otp/verify", verifyOtpHandler);
router.post("/complete-signup", completeSignupHandler);

// Add contact — two-step flow (protected)
router.post("/phone/add/request", authenticate, requestAddContactHandler);
router.post("/phone/add/verify", authenticate, verifyAddContactHandler);

// Token management (unchanged)
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
