import { v4 as uuidv4 } from "uuid";
import { getProducer } from "./producer.js";
import { TOPICS } from "./topics.js";
import { DRIVER_EVENTS } from "./events.js";
import type {
  KafkaEventEnvelope,
  DriverRegisteredPayload,
  DriverAssignedPayload,
  DriverLocationUpdatedPayload,
} from "./types.js";

const buildEnvelope = <T>(event: string, data: T): KafkaEventEnvelope<T> => ({
  event,
  version: 1,
  timestamp: new Date().toISOString(),
  source: "driver-service",
  correlationId: uuidv4(),
  data,
});

const publish = async <T>(envelope: KafkaEventEnvelope<T>): Promise<void> => {
  const producer = getProducer();
  if (!producer) {
    console.warn(`[Kafka] Producer not ready. Dropping event: ${envelope.event}`);
    return;
  }

  try {
    await producer.send({
      topic: TOPICS.DRIVER_EVENTS,
      messages: [{ value: JSON.stringify(envelope) }],
    });
  } catch (error) {
    console.error(`[Kafka] Failed to publish event ${envelope.event}:`, error);
  }
};

export const publishDriverRegistered = async (data: DriverRegisteredPayload): Promise<void> => {
  await publish(buildEnvelope(DRIVER_EVENTS.DRIVER_REGISTERED, data));
};

export const publishDriverAssigned = async (data: DriverAssignedPayload): Promise<void> => {
  await publish(buildEnvelope(DRIVER_EVENTS.DRIVER_ASSIGNED, data));
};

export const publishLocationUpdated = async (data: DriverLocationUpdatedPayload): Promise<void> => {
  await publish(buildEnvelope(DRIVER_EVENTS.DRIVER_LOCATION_UPDATED, data));
};
