import { connectProducer, disconnectProducer } from "./producer.js";

/**
 * Initializes Kafka producer and topic requirements on service bootstrap.
 */
export const initKafka = async (): Promise<void> => {
  await connectProducer();
};

/**
 * Gracefully shuts down active Kafka connections on process termination.
 */
export const shutdownKafka = async (): Promise<void> => {
  await disconnectProducer();
};

// Re-export public Kafka interface components
export * from "./types.js";
export * from "./events.js";
export * from "./topics.js";
export * from "./eventPublisher.js";
