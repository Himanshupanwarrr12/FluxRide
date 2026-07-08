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

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Malformed token" });
      return;
    }
    const secret = process.env.JWT_SECRET || "super_secret_jwt_key";

    const decoded = jwt.verify(token, secret as string) as any;
    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
