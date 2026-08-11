import { type Consumer, type EachMessagePayload } from "kafkajs";
import { kafka } from "./kafka.service.js";

let consumer: Consumer | null = null;

export const connectConsumer = async (groupId: string): Promise<Consumer> => {
  if (consumer) return consumer;

  consumer = kafka.consumer({ groupId });
  try {
    await consumer.connect();
    console.log(`[Kafka] Driver Service consumer connected (group: ${groupId})`);
  } catch (error) {
    console.error("[Kafka] Failed to connect consumer:", error);
    throw error;
  }

  return consumer;
};

export const subscribeAndRun = async (
  topic: string,
  handler: (payload: EachMessagePayload) => Promise<void>
): Promise<void> => {
  if (!consumer) {
    throw new Error("Kafka consumer not connected");
  }

  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload) => {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[Kafka] Error handling message from topic ${topic}:`, error);
      }
    },
  });
};

export const disconnectConsumer = async (): Promise<void> => {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    console.log("[Kafka] Driver Service consumer disconnected");
  }
};
