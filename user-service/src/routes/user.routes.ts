import { Router } from "express";
import { getProfile, updateProfile, deleteAccount } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.delete("/account", deleteAccount);

export default router;
