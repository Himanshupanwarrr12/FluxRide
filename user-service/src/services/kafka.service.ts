import { Kafka, type Producer } from "kafkajs";
import "dotenv/config";

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";

export const kafka = new Kafka({
  clientId: "user-service",
  brokers: [KAFKA_BROKER],
});

let producer: Producer | null = null;

export const initKafkaAdmin = async () => {
  const admin = kafka.admin();
  try {
    await admin.connect();
    console.log("User Service connected to Kafka Admin");

    // Define topics for the Uber/Ola clone (User domain)
    const topics = [
      {
        topic: "user-events", // e.g., user created, updated, deleted
        numPartitions: 3,
        replicationFactor: 1, // 1 for local dev, increase for production
      }
    ];

    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics.filter(t => !existingTopics.includes(t.topic));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate,
      });
      console.log(`Created topics: ${topicsToCreate.map(t => t.topic).join(', ')}`);
    } else {
      console.log("All topics already exist.");
    }
  } catch (error) {
    console.error("Failed to initialize Kafka Admin or create topics", error);
  } finally {
    await admin.disconnect();
    console.log("Kafka Admin disconnected");
  }
};

export const connectKafkaProducer = async () => {
  if (producer) return producer;
  
  // Ensure topics are created before producer connects
  await initKafkaAdmin();
  
  producer = kafka.producer();
  try {
    await producer.connect();
    console.log("User Service connected to Kafka Producer");
  } catch (error) {
    console.error("Failed to connect Kafka Producer", error);
  }
  
  return producer;
};

export const disconnectKafkaProducer = async () => {
  if (producer) {
    await producer.disconnect();
    console.log("User Service disconnected from Kafka Producer");
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
