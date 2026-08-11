import { getNearbyDrivers, markDriverAvailable, markDriverOnRide } from "./driver.service.js";
import { publishDriverAssigned } from "../kafka/eventPublisher.js";
import { RIDE_EVENTS } from "../kafka/events.js";
import type {
  KafkaEventEnvelope,
  RideRequestedPayload,
  RideCompletedPayload,
  RideCancelledPayload,
} from "../kafka/types.js";

export const handleRideEvent = async (rawMessage: string | null): Promise<void> => {
  if (!rawMessage) return;

  let envelope: KafkaEventEnvelope;
  try {
    envelope = JSON.parse(rawMessage) as KafkaEventEnvelope;
  } catch {
    console.error("[RideHandler] Failed to parse message:", rawMessage);
    return;
  }

  const { event, data } = envelope;

  if (event === RIDE_EVENTS.RIDE_REQUESTED) {
    await onRideRequested(data as RideRequestedPayload);
  } else if (event === RIDE_EVENTS.RIDE_COMPLETED) {
    await onRideCompleted(data as RideCompletedPayload);
  } else if (event === RIDE_EVENTS.RIDE_CANCELLED) {
    await onRideCancelled(data as RideCancelledPayload);
  }
};

// ── RIDE_REQUESTED: find nearest driver and assign ───────────────────────────

const onRideRequested = async (data: RideRequestedPayload): Promise<void> => {
  try {
    const { rideId, pickupLat, pickupLng } = data;

    const { drivers } = await getNearbyDrivers(pickupLat, pickupLng, 5); // 5km radius

    if (drivers.length === 0) {
      console.warn(`[RideHandler] No available drivers near ride ${rideId}`);
      return;
    }

    const nearest = drivers[0];
    if (!nearest) return;

    await markDriverOnRide(nearest.id);

    const etaMinutes = Math.ceil(nearest.distanceKm * 3); // ~3 min/km estimate

    await publishDriverAssigned({
      driverId: nearest.id,
      rideId,
      eta: etaMinutes,
    });

    console.log(`[RideHandler] Driver ${nearest.id} assigned to ride ${rideId}`);
  } catch (error) {
    console.error("[RideHandler] Error handling RIDE_REQUESTED:", error);
  }
};

// ── RIDE_COMPLETED: mark driver available again ──────────────────────────────

const onRideCompleted = async (data: RideCompletedPayload): Promise<void> => {
  try {
    const { driverId } = data;
    await markDriverAvailable(driverId);
    console.log(`[RideHandler] Driver ${driverId} is now ONLINE after ride completion`);
  } catch (error) {
    console.error("[RideHandler] Error handling RIDE_COMPLETED:", error);
  }
};

// ── RIDE_CANCELLED: mark driver available again ──────────────────────────────

const onRideCancelled = async (data: RideCancelledPayload): Promise<void> => {
  try {
    const { driverId } = data;
    await markDriverAvailable(driverId);
    console.log(`[RideHandler] Driver ${driverId} is now ONLINE after ride cancellation`);
  } catch (error) {
    console.error("[RideHandler] Error handling RIDE_CANCELLED:", error);
  }
};
