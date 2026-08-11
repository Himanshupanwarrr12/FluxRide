// Centralized Kafka event name constants for driver-service
// Events this service publishes (driver.events topic)
export const DRIVER_EVENTS = {
  DRIVER_REGISTERED: "DRIVER_REGISTERED",
  DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
  DRIVER_LOCATION_UPDATED: "DRIVER_LOCATION_UPDATED",
} as const;

// Events this service consumes (ride.events topic)
export const RIDE_EVENTS = {
  RIDE_REQUESTED: "RIDE_REQUESTED",
  RIDE_COMPLETED: "RIDE_COMPLETED",
  RIDE_CANCELLED: "RIDE_CANCELLED",
} as const;
