import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis.js";
import { addDriverLocation, removeDriverLocation } from "../lib/geo.js";
import { publishLocationUpdated } from "../kafka/eventPublisher.js";
import { getDriverByUserId } from "../services/driver.service.js";
import { prisma } from "../lib/prisma.js";
import { register, unregister } from "./ws.manager.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface LocationMessage {
  latitude: number;
  longitude: number;
}

interface JwtPayload {
  id: string;
  role: string;
  currentMode: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? "super_secret_jwt_key";
const DISCONNECT_GRACE_MS = 30_000;  // 30 seconds before marking driver offline
const LAST_SEEN_TTL = 60;            // 60 seconds Redis TTL for lastSeen key

// ── Disconnect grace-period timers ───────────────────────────────────────────
// On disconnect, we wait 30 seconds before cleaning up. If the driver
// reconnects within that window, the timer is cancelled and they continue
// seamlessly without being marked offline.

const disconnectTimers = new Map<string, NodeJS.Timeout>();

// ── Helpers ──────────────────────────────────────────────────────────────────

const isValidLatitude = (lat: number): boolean =>
  typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90;

const isValidLongitude = (lng: number): boolean =>
  typeof lng === "number" && !isNaN(lng) && lng >= -180 && lng <= 180;

// ── Setup Function ───────────────────────────────────────────────────────────

/**
 * Attaches handshake authentication and location stream event handling
 * to the Socket.IO "/location" namespace.
 */
export const setupLocationSocket = (io: Server): void => {
  const locationNamespace = io.of("/location");

  // ── Handshake Authentication Middleware ────────────────────────────────────
  locationNamespace.use(async (socket: Socket, next) => {
    try {
      const rawToken =
        (socket.handshake.auth?.token as string | undefined) ||
        (typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization
          : undefined);

      if (!rawToken || typeof rawToken !== "string") {
        return next(new Error("Unauthorized: Missing token"));
      }

      const token = rawToken.replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
      if (!token) {
        return next(new Error("Unauthorized: Malformed token"));
      }

      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      } catch {
        return next(new Error("Unauthorized: Invalid token"));
      }

      try {
        const { driver } = await getDriverByUserId(decoded.id);
        socket.data.driverId = driver.id;
        return next();
      } catch {
        return next(new Error("Unauthorized: Driver profile not found"));
      }
    } catch (err) {
      console.error("[WS] Authentication error:", err);
      return next(new Error("Unauthorized: Authentication failed"));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────────────────
  locationNamespace.on("connection", (socket: Socket) => {
    const driverId = socket.data.driverId as string;

    // Cancel any pending disconnect grace-period timer from a previous connection
    const pendingTimer = disconnectTimers.get(driverId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      disconnectTimers.delete(driverId);
      console.log(`[WS] Driver ${driverId} reconnected — cancelled pending offline timer`);
    }

    register(driverId, socket);
    socket.emit("connected", { type: "connected", message: "Location streaming started" });
    console.log(`[WS] Driver ${driverId} authenticated and connected`);

    // ── Single Location Event ────────────────────────────────────────────────
    socket.on("location", async (data: unknown, callback?: (res: unknown) => void) => {
      try {
        const { latitude, longitude } = (data ?? {}) as LocationMessage;

        // Validate coordinates
        if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
          socket.emit("error", { type: "error", message: "Invalid coordinates" });
          return;
        }

        const now = new Date();
        const timestamp = now.toISOString();

        // GEOADD drivers:online longitude latitude driverId
        // (Redis takes longitude first)
        await addDriverLocation(driverId, latitude, longitude);

        // SET driver:lastSeen:{driverId} = ISO timestamp EX 60
        await redis.set(
          `driver:lastSeen:${driverId}`,
          timestamp,
          "EX",
          LAST_SEEN_TTL
        );

        // Fire Kafka event: driver.location_updated
        await publishLocationUpdated({
          driverId,
          lat: latitude,
          lng: longitude,
          timestamp,
        });

        // Update PostgreSQL lastSeenAt — fire-and-forget
        prisma.driver.update({
          where: { id: driverId },
          data: { lastSeenAt: now },
        }).catch((err) => {
          console.error(`[WS] Failed to update lastSeenAt for driver ${driverId}:`, err);
        });

        socket.emit("location_ack", { type: "location_ack" });
        if (typeof callback === "function") {
          callback({ status: "ok" });
        }
      } catch (err) {
        console.error(`[WS] Error processing location message (driver: ${driverId}):`, err);
        socket.emit("error", { type: "error", message: "Failed to process message" });
      }
    });

    // ── Disconnect Behavior ──────────────────────────────────────────────────
    socket.on("disconnect", (reason: string) => {
      console.log(`[WS] Connection disconnected (driver: ${driverId}, reason: ${reason})`);

      unregister(driverId);

      const id = driverId;
      const timer = setTimeout(async () => {
        try {
          // ZREM drivers:online driverId — remove from Redis GEO
          await removeDriverLocation(id);

          // Update PostgreSQL: status = OFFLINE, lastSeenAt = now
          await prisma.driver.update({
            where: { id },
            data: {
              status: "OFFLINE",
              lastSeenAt: new Date(),
            },
          });

          console.log(`[WS] Driver ${id} grace period expired — marked OFFLINE, removed from Redis GEO`);
        } catch (err) {
          console.error(`[WS] Cleanup error for driver ${id}:`, err);
        } finally {
          disconnectTimers.delete(id);
        }
      }, DISCONNECT_GRACE_MS);

      disconnectTimers.set(id, timer);
      console.log(`[WS] Driver ${id} disconnect grace period started (${DISCONNECT_GRACE_MS / 1000}s)`);
    });

    // ── Error Handling ───────────────────────────────────────────────────────
    socket.on("error", (err: Error) => {
      console.error(`[WS] Socket error (driver: ${driverId}):`, err.message);
    });
  });
};
