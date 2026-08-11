// TypeScript types for Kafka event envelopes and payloads

export interface KafkaEventEnvelope<T = unknown> {
  event: string;
  version: number;
  timestamp: string;
  source: string;
  correlationId: string;
  data: T;
}

// ── Driver Event Payloads ────────────────────────────────────────────────────

export interface DriverRegisteredPayload {
  driverId: string;
  userId: string;
  licenseNumber: string;
}

export interface DriverAssignedPayload {
  driverId: string;
  rideId: string;
  eta: number; // estimated minutes
}

export interface DriverLocationUpdatedPayload {
  driverId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

// ── Ride Event Payloads (consumed) ──────────────────────────────────────────

export interface RideRequestedPayload {
  rideId: string;
  riderId: string;
  pickupLat: number;
  pickupLng: number;
}

export interface RideCompletedPayload {
  rideId: string;
  driverId: string;
}

export interface RideCancelledPayload {
  rideId: string;
  driverId: string;
}
