import { type Producer } from "kafkajs";
import { kafka } from "./kafka.service.js";

let producer: Producer | null = null;

export const connectProducer = async (): Promise<Producer> => {
  if (producer) return producer;

  producer = kafka.producer();
  try {
    await producer.connect();
    console.log("[Kafka] Driver Service producer connected");
  } catch (error) {
    console.error("[Kafka] Failed to connect producer:", error);
    throw error;
  }

  return producer;
};

export const disconnectProducer = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log("[Kafka] Driver Service producer disconnected");
  }
};

export const getProducer = (): Producer | null => producer;
