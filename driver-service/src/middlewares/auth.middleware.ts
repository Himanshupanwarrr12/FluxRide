import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
    if (!token) {
      res.status(401).json({ message: "Malformed token" });
      return;
    }

    const secret = process.env.JWT_SECRET ?? "super_secret_jwt_key";
    const decoded = jwt.verify(token, secret) as { id: string; role: string };
    req.user = decoded;

    next();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Invalid or expired token";
    console.error("[Auth] Token verification failed:", errorMsg);
    res.status(401).json({ message: "Invalid or expired token", error: errorMsg });
  }
};

