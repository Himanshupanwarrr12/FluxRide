import type { Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  sendOtp,
  verifyOtp,
  completeSignup,
  requestAddContact,
  verifyAddContact,
  refreshTokenService,
  logoutUser,
} from "../services/auth.service.js";

export const requestOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, purpose } = req.body;

    if (!identifier) {
      res.status(400).json({ message: "Identifier (email or phone) is required" });
      return;
    }

    const result = await sendOtp(identifier, purpose);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Request OTP Error:", error);
    if (error.message === "Please wait before requesting a new OTP") {
      res.status(429).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const verifyOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, otp, purpose } = req.body;

    if (!identifier || !otp) {
      res.status(400).json({ message: "Identifier and OTP are required" });
      return;
    }

    const result = await verifyOtp(identifier, otp, purpose);

    if (result.isNewUser) {
      res.status(200).json({
        message: "OTP verified. Complete signup to create your account",
        isNewUser: true,
        registrationToken: result.registrationToken,
        identifierType: result.identifierType,
      });
    } else {
      res.status(200).json({
        message: "Login successful",
        isNewUser: false,
        user: result.user,
        tokens: result.tokens,
        requiresPhone: result.requiresPhone,
      });
    }
  } catch (error: any) {
    console.error("Verify OTP Error:", error);
    if (error.message === "OTP not found or expired") {
      res.status(401).json({ message: error.message });
      return;
    }
    if (error.message === "Invalid OTP") {
      res.status(401).json({ message: error.message });
      return;
    }
    if (error.message === "Maximum OTP attempts exceeded. Please request a new OTP") {
      res.status(429).json({ message: error.message });
      return;
    }
    if (error.message === "Account has been deleted" || error.message === "Account has been suspended") {
      res.status(403).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const completeSignupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { registrationToken, firstName, lastName, role } = req.body;

    if (!registrationToken || !firstName || !lastName) {
      res.status(400).json({ message: "Registration token, firstName, and lastName are required" });
      return;
    }

    const result = await completeSignup(registrationToken, firstName, lastName, role);
    res.status(201).json({
      message: "Account created successfully",
      user: result.user,
      tokens: result.tokens,
    });
  } catch (error: any) {
    console.error("Complete Signup Error:", error);
    if (
      error.message === "Invalid registration token" ||
      error.message === "Registration token has already been used" ||
      error.message === "Registration token has expired"
    ) {
      res.status(400).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const requestAddContactHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { newIdentifier } = req.body;
    if (!newIdentifier) {
      res.status(400).json({ message: "New identifier (email or phone) is required" });
      return;
    }

    const result = await requestAddContact(userId, newIdentifier);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Request Add Contact Error:", error);
    if (error.message === "This identifier is already associated with another account") {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error.message === "Please wait before requesting a new OTP") {
      res.status(429).json({ message: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const verifyAddContactHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { newIdentifier, otp } = req.body;
    if (!newIdentifier || !otp) {
      res.status(400).json({ message: "New identifier and OTP are required" });
      return;
    }

    const result = await verifyAddContact(userId, newIdentifier, otp);
    res.status(200).json({ message: "Contact added successfully", ...result });
  } catch (error: any) {
    console.error("Verify Add Contact Error:", error);
    if (error.message === "Invalid OTP" || error.message === "OTP not found or expired") {
      res.status(401).json({ message: error.message });
      return;
    }
    if (error.message === "Maximum OTP attempts exceeded. Please request a new OTP") {
      res.status(429).json({ message: error.message });
      return;
    }
    if (error.message === "This identifier is already associated with another account") {
      res.status(400).json({ message: error.message });
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
