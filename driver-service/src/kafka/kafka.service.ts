import { Kafka } from "kafkajs";
import "dotenv/config";

const KAFKA_BROKER = process.env.KAFKA_BROKER ?? "localhost:9092";

export const kafka = new Kafka({
  clientId: "driver-service",
  brokers: [KAFKA_BROKER],
});
