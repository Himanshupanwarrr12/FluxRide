import type { Producer } from "kafkajs";
import { kafkaClient, initKafkaTopics } from "./topics.js";
import { logger } from "./logger.js";

let producerInstance: Producer | null = null;
let isConnected = false;
let isConnecting = false;

/**
 * Returns the connected singleton Producer instance or connects if not already connected.
 */
export const connectProducer = async (): Promise<Producer> => {
  if (producerInstance && isConnected) {
    return producerInstance;
  }

  if (isConnecting) {
    logger.info("Producer connection already in progress, awaiting initialization...");
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (producerInstance && isConnected) {
      return producerInstance;
    }
  }

  isConnecting = true;

  try {
    // Ensure domain topics exist prior to producer initialization
    await initKafkaTopics();

    if (!producerInstance) {
      producerInstance = kafkaClient.producer();
    }

    await producerInstance.connect();
    isConnected = true;
    logger.info("Kafka Singleton Producer connected successfully");
    return producerInstance;
  } catch (error) {
    isConnected = false;
    logger.error("Failed to connect Kafka Producer", error);
    throw error;
  } finally {
    isConnecting = false;
  }
};

/**
 * Retrieves current active producer instance, returning null if not connected.
 */
export const getProducer = (): Producer | null => {
  return isConnected ? producerInstance : null;
};

/**
 * Gracefully disconnects the singleton Kafka Producer on application shutdown.
 */
export const disconnectProducer = async (): Promise<void> => {
  if (producerInstance && isConnected) {
    try {
      await producerInstance.disconnect();
      isConnected = false;
      producerInstance = null;
      logger.info("Kafka Singleton Producer disconnected successfully");
    } catch (error) {
      logger.error("Error during Kafka Producer disconnection", error);
    }
  }
};
