import type { Request, Response } from "express";
import { registerUser, loginUser, getUserProfile } from "../services/auth.service.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({
      message: "User created successfully",
      user: result.user,
      tokens: result.tokens
    });
  } catch (error: any) {
    console.error("Register Error:", error);
    if (error.message === "User with this email or phone already exists") {
      res.status(400).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({
      message: "Login successful",
      user: result.user,
      tokens: result.tokens
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    if (error.message === "User not found") {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error.message === "Invalid credentials") {
      res.status(401).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id;

    if (!id || typeof id !== "string") {
      res.status(400).json({ message: "Invalid or missing user ID" });
      return;
    }

    const result = await getUserProfile(id);
    res.status(200).json({
      user: result.user,
    });
  } catch (error: any) {
    console.error("Profile Error:", error);
    if (error.message === "User not found") {
      res.status(404).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};
