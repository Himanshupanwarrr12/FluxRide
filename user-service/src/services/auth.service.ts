import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export const generateTokens = (user: { id: string, role: string }) => {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!secret || !refreshSecret) {
    throw new Error("JWT_SECRET or JWT_REFRESH_SECRET is not defined");
  }

  const accessToken = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

export const registerUser = async (data: any) => {
  const { email, phone, password, firstName, lastName, role } = data;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
  });

  if (existingUser) {
    throw new Error("User with this email or phone already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || "RIDER",
    },
  });

  const { password: _, ...userWithoutPassword } = user;

  const tokens = generateTokens(user);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return { user: userWithoutPassword, tokens };
};

export const loginUser = async (data: any) => {
  const { email, password } = data;

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === "DELETED") {
    throw new Error("Account has been deleted");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  const { password: _, ...userWithoutPassword } = user;

  const tokens = generateTokens(user);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return { user: userWithoutPassword, tokens };
};

export const refreshTokenService = async (refreshToken: string) => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not defined");
  }

  const decoded = jwt.verify(refreshToken, refreshSecret) as { id: string };

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  });

  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    throw new Error("Invalid or expired refresh token");
  }

  if (storedToken.user.status === "DELETED") {
    throw new Error("Account has been deleted");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  const accessToken = jwt.sign(
    { id: storedToken.user.id, role: storedToken.user.role },
    secret,
    { expiresIn: '15m' }
  );

  return { accessToken };
};

export const logoutUser = async (refreshToken: string) => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken }
  });

  if (storedToken) {
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true }
    });
  }

  return { message: "Logged out successfully" };
};
