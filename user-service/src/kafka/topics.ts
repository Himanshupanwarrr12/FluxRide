import { Kafka } from "kafkajs";
import { logger } from "./logger.js";

export const KAFKA_CONFIG = {
  CLIENT_ID: "user-service",
  SOURCE: "user-service",
  BROKER: process.env.KAFKA_BROKER || "localhost:9092",
};

export const KAFKA_TOPICS = {
  USER_EVENTS: "user.events",
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

export const kafkaClient = new Kafka({
  clientId: KAFKA_CONFIG.CLIENT_ID,
  brokers: [KAFKA_CONFIG.BROKER],
});

/**
 * Initializes Kafka Admin to ensure required domain topics exist.
 */
export const initKafkaTopics = async (): Promise<void> => {
  const admin = kafkaClient.admin();
  try {
    await admin.connect();
    logger.info("Connected to Kafka Admin for topic verification");

    const requiredTopics = [
      {
        topic: KAFKA_TOPICS.USER_EVENTS,
        numPartitions: 3,
        replicationFactor: 1, // Dev default; adjust via cluster config in production
      },
    ];

    const existingTopics = await admin.listTopics();
    const topicsToCreate = requiredTopics.filter((t) => !existingTopics.includes(t.topic));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate,
      });
      logger.info(`Successfully created Kafka topics: ${topicsToCreate.map((t) => t.topic).join(", ")}`);
    } else {
      logger.info("All required Kafka topics already exist");
    }
  } catch (error) {
    logger.error("Failed to initialize Kafka topics via Admin", error);
  } finally {
    try {
      await admin.disconnect();
      logger.info("Kafka Admin disconnected successfully");
    } catch (disconnectError) {
      logger.error("Error disconnecting Kafka Admin", disconnectError);
    }
  }
};
