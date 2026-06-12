import { Router } from "express";
import { register, login, getProfile } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile/:id", getProfile);

export default router;
