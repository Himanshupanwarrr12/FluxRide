import type { Request, Response } from "express";
import { registerUser, loginUser, refreshTokenService, logoutUser } from "../services/auth.service.js";

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
    if (error.message === "Invalid credentials" || error.message === "Account has been deleted") {
      res.status(401).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ message: "Refresh token is required" });
      return;
    }

    const result = await refreshTokenService(refreshToken);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Refresh Error:", error);
    res.status(401).json({ message: error.message || "Invalid refresh token" });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ message: "Refresh token is required" });
      return;
    }

    const result = await logoutUser(refreshToken);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Logout Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};
