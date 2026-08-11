// Centralized Kafka topic names for driver-service
export const TOPICS = {
  DRIVER_EVENTS: "driver.events",
  RIDE_EVENTS: "ride.events",
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
