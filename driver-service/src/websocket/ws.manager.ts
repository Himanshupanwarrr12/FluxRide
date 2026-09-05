import { WebSocket } from "ws";

// ── Active Driver Connections ────────────────────────────────────────────────
// Maps driverId → WebSocket so other services (e.g., Ride Service) can push
// messages directly to a specific driver in real time.

export const activeDrivers = new Map<string, WebSocket>();

/**
 * Register a driver's WebSocket connection.
 * Replaces any existing connection for the same driver.
 */
export const register = (driverId: string, ws: WebSocket): void => {
  activeDrivers.set(driverId, ws);
  console.log(`[WS Manager] Driver ${driverId} registered (total: ${activeDrivers.size})`);
};

/**
 * Unregister a driver's WebSocket connection.
 */
export const unregister = (driverId: string): void => {
  activeDrivers.delete(driverId);
  console.log(`[WS Manager] Driver ${driverId} unregistered (total: ${activeDrivers.size})`);
};

/**
 * Send a JSON payload to a specific driver's WebSocket.
 * Useful for Ride Service to push ride requests to a driver.
 */
export const notifyDriver = (driverId: string, payload: object): void => {
  const ws = activeDrivers.get(driverId);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    console.warn(`[WS Manager] Cannot notify driver ${driverId}: not connected`);
  }
};

/**
 * Check whether a driver has an active, open WebSocket connection.
 */
export const isConnected = (driverId: string): boolean => {
  const ws = activeDrivers.get(driverId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
};
