import { Kafka } from "kafkajs";
import "dotenv/config";
import { TOPICS } from "./topics.js";

const KAFKA_BROKER = process.env.KAFKA_BROKER ?? "localhost:9092";

export const kafka = new Kafka({
  clientId: "driver-service",
  brokers: [KAFKA_BROKER],
});

export const initKafkaTopics = async (): Promise<void> => {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const needed = [TOPICS.DRIVER_EVENTS, TOPICS.RIDE_EVENTS].filter(
      (topic) => !existingTopics.includes(topic)
    );
    if (needed.length > 0) {
      await admin.createTopics({
        topics: needed.map((topic) => ({
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        })),
      });
      console.log(`[Kafka] Initialized topics: ${needed.join(", ")}`);
    }
  } catch (error) {
    console.warn("[Kafka] Topic auto-creation warning:", error);
  } finally {
    await admin.disconnect();
  }
};
