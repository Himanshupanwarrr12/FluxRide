import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  getUserProfileById,
  updateUserProfile,
  softDeleteUserAccount,
} from "../services/user.service.js";

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await getUserProfileById(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get Profile Error:", error);
    if (error.message === "User not found") {
      res.status(404).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { firstName, lastName, phone } = req.body;
    const result = await updateUserProfile(userId, { firstName, lastName, phone });
    res.status(200).json({
      message: "Profile updated successfully",
      user: result.user,
    });
  } catch (error: any) {
    console.error("Update Profile Error:", error);
    if (error.message === "User not found") {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error.message === "Phone number is already in use by another account") {
      res.status(400).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await softDeleteUserAccount(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete Account Error:", error);
    if (error.message === "User not found") {
      res.status(404).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};
