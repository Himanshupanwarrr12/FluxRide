import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis.js";
import { addDriverLocation, removeDriverLocation } from "../lib/geo.js";
import { publishLocationUpdated } from "../kafka/eventPublisher.js";
import { getDriverByUserId } from "../services/driver.service.js";
import { prisma } from "../lib/prisma.js";
import { register, unregister } from "./ws.manager.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthMessage {
  token: string;
}

interface LocationMessage {
  latitude: number;
  longitude: number;
}

interface JwtPayload {
  id: string;
  role: string;
  currentMode: string;
}

interface WsOutgoing {
  type: string;
  message?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? "super_secret_jwt_key";
const AUTH_TIMEOUT_MS = 10_000;      // 10 seconds to send first auth message
const DISCONNECT_GRACE_MS = 30_000;  // 30 seconds before marking driver offline
const LAST_SEEN_TTL = 60;            // 60 seconds Redis TTL for lastSeen key

// ── Disconnect grace-period timers ───────────────────────────────────────────
// On disconnect, we wait 30 seconds before cleaning up. If the driver
// reconnects within that window, the timer is cancelled and they continue
// seamlessly without being marked offline.

const disconnectTimers = new Map<string, NodeJS.Timeout>();

// ── Helpers ──────────────────────────────────────────────────────────────────

const send = (ws: WebSocket, data: WsOutgoing): void => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
};

const isValidLatitude = (lat: number): boolean =>
  typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90;

const isValidLongitude = (lng: number): boolean =>
  typeof lng === "number" && !isNaN(lng) && lng >= -180 && lng <= 180;

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Handles a single driver's WebSocket lifecycle:
 *
 *  1. Auth timeout  — close if no message within 10 seconds
 *  2. First message — must be { token: "JWT" } for authentication
 *  3. Subsequent    — location updates { latitude, longitude }
 *  4. On close      — 30-second grace period before Redis/Postgres cleanup
 *  5. On reconnect  — cancel pending grace-period timer
 */
export const handleLocationStream = (ws: WebSocket, _req: IncomingMessage): void => {
  let driverId: string | null = null;

  // ── STEP 1: Auth timeout ─────────────────────────────────────────────────
  // If the first message doesn't arrive within 10 seconds, kill the socket.
  // Prevents unauthenticated connections from lingering forever.

  const authTimeout = setTimeout(() => {
    send(ws, { type: "error", message: "Authentication timeout" });
    ws.close(4000, "Auth timeout");
  }, AUTH_TIMEOUT_MS);

  // ── STEP 2: First message must be auth ───────────────────────────────────
  // Uses ws.once("message") so auth logic runs exactly once, and subsequent
  // messages are handled by a separate listener attached only after success.

  ws.once("message", async (raw: Buffer | string) => {
    try {
      const data: unknown = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      const { token } = data as AuthMessage;

      // Validate token presence
      if (!token || typeof token !== "string") {
        send(ws, { type: "error", message: "Unauthorized" });
        ws.close(4001, "Missing token");
        return;
      }

      // Verify JWT
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      } catch {
        send(ws, { type: "error", message: "Unauthorized" });
        ws.close(4003, "Authentication failed");
        return;
      }

      // Resolve driver record from userId in the JWT payload
      // driverId always comes from the JWT — never from message body
      try {
        const { driver } = await getDriverByUserId(decoded.id);
        driverId = driver.id;
      } catch {
        send(ws, { type: "error", message: "Driver profile not found" });
        ws.close(4004, "Driver not found");
        return;
      }

      // ── Auth success ───────────────────────────────────────────────────────
      clearTimeout(authTimeout);

      // Cancel any pending disconnect grace-period timer from a previous
      // connection (driver reconnected within the 30-second window)
      const pendingTimer = disconnectTimers.get(driverId);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        disconnectTimers.delete(driverId);
        console.log(`[WS] Driver ${driverId} reconnected — cancelled pending offline timer`);
      }

      register(driverId, ws);
      send(ws, { type: "connected", message: "Location streaming started" });
      console.log(`[WS] Driver ${driverId} authenticated and connected`);

      // ── STEP 3: Listen for location messages (post-auth) ─────────────────
      ws.on("message", async (rawMsg: Buffer | string) => {
        try {
          const msgData: unknown = JSON.parse(
            typeof rawMsg === "string" ? rawMsg : rawMsg.toString()
          );
          const { latitude, longitude } = msgData as LocationMessage;

          // Validate coordinates
          if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
            send(ws, { type: "error", message: "Invalid coordinates" });
            return; // Skip this message — don't close the connection
          }

          const now = new Date();
          const timestamp = now.toISOString();

          // GEOADD drivers:online longitude latitude driverId
          // (Redis takes longitude first — important)
          await addDriverLocation(driverId!, latitude, longitude);

          // SET driver:lastSeen:{driverId} = ISO timestamp  EX 60
          // Expires in 60 seconds — shows how fresh the location data is
          await redis.set(
            `driver:lastSeen:${driverId}`,
            timestamp,
            "EX",
            LAST_SEEN_TTL
          );

          // Fire Kafka event: driver.location_updated
          await publishLocationUpdated({
            driverId: driverId!,
            lat: latitude,
            lng: longitude,
            timestamp,
          });

          // Update PostgreSQL lastSeenAt — fire-and-forget (don't block location processing)
          prisma.driver.update({
            where: { id: driverId! },
            data: { lastSeenAt: now },
          }).catch((err) => {
            console.error(`[WS] Failed to update lastSeenAt for driver ${driverId}:`, err);
          });

          send(ws, { type: "location_ack" });
        } catch (err) {
          console.error(`[WS] Error processing location message (driver: ${driverId}):`, err);
          send(ws, { type: "error", message: "Failed to process message" });
        }
      });
    } catch (err) {
      console.error("[WS] Error processing auth message:", err);
      send(ws, { type: "error", message: "Unauthorized" });
      ws.close(4002, "Invalid message format");
    }
  });

  // ── STEP 4: Disconnect behavior (robust) ─────────────────────────────────
  // A disconnect is NOT immediately treated as going offline — the network
  // can drop temporarily and the driver might reconnect. We start a 30-second
  // grace period instead. If the driver reconnects within that window, the
  // timer is cancelled (see auth success block above).

  ws.on("close", (code: number, reason: Buffer) => {
    clearTimeout(authTimeout);

    console.log(
      `[WS] Connection closed (driver: ${driverId ?? "unauthenticated"}, ` +
      `code: ${code}, reason: ${reason.toString()})`
    );

    if (!driverId) return;

    // Unregister from active connections immediately
    unregister(driverId);

    // Start grace-period timer
    const id = driverId; // capture for closure
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

  // ── STEP 7: Error handling ─────────────────────────────────────────────────

  ws.on("error", (err: Error) => {
    console.error(`[WS] Socket error (driver: ${driverId ?? "unauthenticated"}):`, err.message);
  });
};
