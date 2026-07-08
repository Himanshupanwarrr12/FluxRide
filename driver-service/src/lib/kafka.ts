import { Kafka, type Producer } from "kafkajs";
import "dotenv/config";

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";

export const kafka = new Kafka({
  clientId: "driver-service",
  brokers: [KAFKA_BROKER],
});

let producer: Producer | null = null;

export const connectKafkaProducer = async () => {
  if (producer) return producer;
  
  producer = kafka.producer();
  try {
    await producer.connect();
    console.log("Driver Service connected to Kafka Producer");
  } catch (error) {
    console.error("Failed to connect Kafka Producer", error);
  }
  
  return producer;
};

export const disconnectKafkaProducer = async () => {
  if (producer) {
    await producer.disconnect();
    console.log("Driver Service disconnected from Kafka Producer");
  }
};

export const publishEvent = async (topic: string, eventType: string, payload: any) => {
  if (!producer) {
    console.warn("Kafka producer not connected. Cannot publish event:", eventType);
    return;
  }

  const message = {
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    }).catch(err => {
      console.error(`Failed to publish event ${eventType} to topic ${topic}:`, err);
    });
  } catch (err) {
    console.error(`Synchronous error publishing event ${eventType}:`, err);
  }
};
