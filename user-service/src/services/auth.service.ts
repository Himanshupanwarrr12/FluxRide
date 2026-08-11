import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OtpPurpose = "LOGIN_OR_SIGNUP" | "ADD_PHONE" | "ADD_EMAIL";

interface OtpData {
  otpHash: string;
  attempts: number;
}

interface RegistrationData {
  identifier: string;
  identifierType: "email" | "phone";
}

// ---------------------------------------------------------------------------
// Redis key builders
// ---------------------------------------------------------------------------

const otpKey = (purpose: OtpPurpose, type: "email" | "phone", identifier: string) =>
  `otp:${purpose}:${type}:${identifier}`;

const cooldownKey = (purpose: OtpPurpose, type: "email" | "phone", identifier: string) =>
  `otp:cooldown:${purpose}:${type}:${identifier}`;

const registrationKey = (token: string) =>
  `registration:${token}`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_TTL_SECONDS = 300;        // 5 minutes
const COOLDOWN_TTL_SECONDS = 60;    // 1 minute
const MAX_OTP_ATTEMPTS = 5;
const REGISTRATION_TTL_SECONDS = 900; // 15 minutes

// ---------------------------------------------------------------------------
// Helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Detect identifier type and normalize.
 * Emails: lowercase + trim.
 * Phones: strip everything except digits and leading '+', ensure '+' prefix.
 */
const normalizeIdentifier = (raw: string): { identifier: string; type: "email" | "phone" } => {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return { identifier: trimmed.toLowerCase(), type: "email" };
  }
  // Phone: keep digits and leading '+'
  let phone = trimmed.replace(/[^\d+]/g, "");
  if (!phone.startsWith("+")) {
    phone = `+${phone}`;
  }
  return { identifier: phone, type: "phone" };
};

/**
 * Dev-only notification abstraction.
 * // TODO: wire up real provider (Twilio / SendGrid / etc.)
 */
const sendOtpNotification = (identifier: string, otp: string, type: "email" | "phone"): void => {
  // TODO: wire up real provider (Twilio/SendGrid/etc.)
  if (process.env.NODE_ENV !== "production") {
    // DEV ONLY — remove this console.log before production
    console.log(`[DEV] OTP for ${type} ${identifier}: ${otp}`);
  }
};

// ---------------------------------------------------------------------------
// Token generation (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// OTP flow
// ---------------------------------------------------------------------------

/**
 * Send a one-time password to the given identifier.
 */
export const sendOtp = async (
  rawIdentifier: string,
  purpose: OtpPurpose = "LOGIN_OR_SIGNUP"
) => {
  const { identifier, type } = normalizeIdentifier(rawIdentifier);

  // Resend cooldown — reject if cooldown key exists in Redis
  const cooldownExists = await redis.exists(cooldownKey(purpose, type, identifier));
  if (cooldownExists) {
    throw new Error("Please wait before requesting a new OTP");
  }

  // Generate cryptographically secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Hash before storing — never store plaintext
  const otpHash = await bcrypt.hash(otp, 10);

  // Store OTP in Redis with TTL (deterministic key replaces any previous OTP)
  const data: OtpData = { otpHash, attempts: 0 };
  await redis.set(
    otpKey(purpose, type, identifier),
    JSON.stringify(data),
    { EX: OTP_TTL_SECONDS }
  );

  // Set cooldown key with 60s TTL
  await redis.set(
    cooldownKey(purpose, type, identifier),
    "1",
    { EX: COOLDOWN_TTL_SECONDS }
  );

  sendOtpNotification(identifier, otp, type);

  return { message: "OTP sent successfully", identifierType: type };
};

/**
 * Verify an OTP and either log the user in or return a registration token.
 */
export const verifyOtp = async (
  rawIdentifier: string,
  otp: string,
  purpose: OtpPurpose = "LOGIN_OR_SIGNUP"
) => {
  const { identifier, type } = normalizeIdentifier(rawIdentifier);

  const key = otpKey(purpose, type, identifier);

  // Get OTP data from Redis
  const raw = await redis.get(key);
  if (!raw) {
    throw new Error("OTP not found or expired");
  }

  const otpData: OtpData = JSON.parse(raw);

  // Max 5 attempts
  if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
    // Delete the key — OTP is now invalid
    await redis.del(key);
    throw new Error("Maximum OTP attempts exceeded. Please request a new OTP");
  }

  // Compare against bcrypt hash
  const isValid = await bcrypt.compare(otp, otpData.otpHash);

  if (!isValid) {
    // Increment attempt counter in Redis
    otpData.attempts += 1;
    // Preserve remaining TTL
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.set(key, JSON.stringify(otpData), { EX: ttl });
    }
    throw new Error("Invalid OTP");
  }

  // Delete OTP key immediately — prevents reuse
  await redis.del(key);

  // Look up existing user by the verified identifier
  const existingUser = await prisma.user.findFirst({
    where:
      type === "email"
        ? { email: identifier }
        : { phone: identifier },
  });

  if (existingUser) {
    // Reject deleted accounts
    if (existingUser.status === "DELETED") {
      throw new Error("Account has been deleted");
    }
    // Reject suspended accounts
    if (existingUser.status === "SUSPENDED") {
      throw new Error("Account has been suspended");
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokens(existingUser);

    // Store refresh token (same pattern as existing code, 7-day expiry)
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: existingUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      isNewUser: false,
      user: existingUser,
      tokens,
      requiresPhone: !existingUser.phone,
    };
  }

  // New user — issue a registration token stored in Redis
  const regToken = crypto.randomBytes(32).toString("hex");

  const regData: RegistrationData = { identifier, identifierType: type };
  await redis.set(
    registrationKey(regToken),
    JSON.stringify(regData),
    { EX: REGISTRATION_TTL_SECONDS }
  );

  return {
    isNewUser: true,
    registrationToken: regToken,
    identifierType: type,
  };
};

/**
 * Complete signup for a new user who has already verified their OTP.
 */
export const completeSignup = async (
  registrationToken: string,
  firstName: string,
  lastName: string,
  role?: "RIDER" | "DRIVER"
) => {
  const key = registrationKey(registrationToken);

  // Get registration data from Redis
  const raw = await redis.get(key);
  if (!raw) {
    throw new Error("Invalid registration token");
  }

  const regData: RegistrationData = JSON.parse(raw);

  // Trust only the identifier stored in Redis — never client-sent
  const { identifier, identifierType: type } = regData;

  const user = await prisma.user.create({
    data: {
      ...(type === "email"
        ? { email: identifier, isEmailVerified: true }
        : { phone: identifier, isPhoneVerified: true }),
      firstName,
      lastName,
      role: role || "RIDER",
      lastLoginAt: new Date(),
    },
  });

  // Delete registration token immediately — one-use
  await redis.del(key);

  const tokens = generateTokens(user);

  // Store refresh token (7-day expiry)
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { user, tokens };
};

/**
 * Request an OTP to add a new contact (phone or email) to an existing account.
 * Protected route — userId comes from JWT, not the client.
 */
export const requestAddContact = async (userId: string, rawIdentifier: string) => {
  const { identifier, type } = normalizeIdentifier(rawIdentifier);

  // Determine purpose from identifier type
  const purpose: OtpPurpose = type === "phone" ? "ADD_PHONE" : "ADD_EMAIL";

  // Make sure the identifier isn't already claimed by another user
  const existingUser = await prisma.user.findFirst({
    where:
      type === "email"
        ? { email: identifier }
        : { phone: identifier },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error("This identifier is already associated with another account");
  }

  // Delegate to sendOtp with the appropriate purpose
  return sendOtp(rawIdentifier, purpose);
};

/**
 * Verify OTP and add a new contact to the authenticated user's account.
 * Protected route — userId comes from JWT, not the client.
 */
export const verifyAddContact = async (
  userId: string,
  rawIdentifier: string,
  otp: string
) => {
  const { identifier, type } = normalizeIdentifier(rawIdentifier);

  const purpose: OtpPurpose = type === "phone" ? "ADD_PHONE" : "ADD_EMAIL";
  const key = otpKey(purpose, type, identifier);

  // Get OTP data from Redis
  const raw = await redis.get(key);
  if (!raw) {
    throw new Error("OTP not found or expired");
  }

  const otpData: OtpData = JSON.parse(raw);

  if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
    await redis.del(key);
    throw new Error("Maximum OTP attempts exceeded. Please request a new OTP");
  }

  const isValid = await bcrypt.compare(otp, otpData.otpHash);

  if (!isValid) {
    otpData.attempts += 1;
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.set(key, JSON.stringify(otpData), { EX: ttl });
    }
    throw new Error("Invalid OTP");
  }

  // Delete OTP key immediately — prevents reuse
  await redis.del(key);

  // Check the identifier isn't already claimed by another user
  const existingUser = await prisma.user.findFirst({
    where:
      type === "email"
        ? { email: identifier }
        : { phone: identifier },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new Error("This identifier is already associated with another account");
  }

  // Update the authenticated user's contact in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data:
        type === "email"
          ? { email: identifier, isEmailVerified: true }
          : { phone: identifier, isPhoneVerified: true },
    }),
  ]);

  return { success: true };
};

// ---------------------------------------------------------------------------
// Refresh / Logout (unchanged)
// ---------------------------------------------------------------------------

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
