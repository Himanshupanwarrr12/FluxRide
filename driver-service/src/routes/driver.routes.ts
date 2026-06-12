import { Router } from "express";
import { registerDriver, getDriverProfile } from "../controllers/driver.controller.js";

const router = Router();

router.post("/register", registerDriver);
router.get("/profile/:id", getDriverProfile);

export default router;
