import type { Socket } from "socket.io";

// ── Active Driver Connections ────────────────────────────────────────────────
// Maps driverId → Socket so other services (e.g., Ride Service) can push
// messages directly to a specific driver in real time.

export const activeDrivers = new Map<string, Socket>();

/**
 * Register a driver's Socket.IO connection.
 * Replaces any existing connection for the same driver.
 */
export const register = (driverId: string, socket: Socket): void => {
  activeDrivers.set(driverId, socket);
  console.log(`[WS Manager] Driver ${driverId} registered (total: ${activeDrivers.size})`);
};

/**
 * Unregister a driver's Socket.IO connection.
 */
export const unregister = (driverId: string): void => {
  activeDrivers.delete(driverId);
  console.log(`[WS Manager] Driver ${driverId} unregistered (total: ${activeDrivers.size})`);
};

/**
 * Send a JSON payload to a specific driver's socket.
 * Useful for Ride Service to push ride requests to a driver.
 */
export const notifyDriver = (driverId: string, payload: object): void => {
  const socket = activeDrivers.get(driverId);

  if (socket && socket.connected) {
    socket.emit("notification", payload);
  } else {
    console.warn(`[WS Manager] Cannot notify driver ${driverId}: not connected`);
  }
};

/**
 * Check whether a driver has an active, open Socket.IO connection.
 */
export const isConnected = (driverId: string): boolean => {
  const socket = activeDrivers.get(driverId);
  return socket !== undefined && socket.connected;
};

