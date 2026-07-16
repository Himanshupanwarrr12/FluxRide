import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.service.js";
import { publishEvent } from "./kafka.service.js";

export const generateTokens = (user: { id: string, role: string }) => {
  const secret = process.env.JWT_SECRET || "super_secret_jwt_key";
  const refreshSecret = process.env.JWT_REFRESH_SECRET || "super_secret_refresh_key";
  
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

  await publishEvent("user.events", "USER_REGISTERED", {
    userId: user.id,
    email: user.email,
    role: user.role
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

export const getUserProfile = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword };
};
