import { Kafka, type Producer, type Consumer } from "kafkajs";
import "dotenv/config";

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";

export const kafka = new Kafka({
  clientId: "payment-service",
  brokers: [KAFKA_BROKER],
});

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export const connectKafkaProducer = async () => {
  if (producer) return producer;
  
  producer = kafka.producer();
  try {
    await producer.connect();
    console.log("Payment Service connected to Kafka Producer");
  } catch (error) {
    console.error("Failed to connect Kafka Producer", error);
  }
  
  return producer;
};

export const disconnectKafkaProducer = async () => {
  if (producer) {
    await producer.disconnect();
    console.log("Payment Service disconnected from Kafka Producer");
  }
};

export const connectKafkaConsumer = async () => {
  if (consumer) return consumer;

  consumer = kafka.consumer({ groupId: "payment-service-group" });
  try {
    await consumer.connect();
    console.log("Payment Service connected to Kafka Consumer");
    
    // Subscribe to topics
    await consumer.subscribe({ topic: "ride.events", fromBeginning: true });
    
    // Run consumer
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        
        try {
          const event = JSON.parse(message.value.toString());
          console.log(`[Payment Service] Received Event: ${event.eventType}`);
          
          if (event.eventType === "RIDE_COMPLETED") {
            // Mock payment processing based on ride completion
            console.log(`Processing payment for ride: ${event.payload.rideId}`);
            // In a real scenario, this would call a payment gateway
            
            // Wait for 2 seconds to simulate payment processing
            setTimeout(() => {
              publishEvent("payment.events", "PAYMENT_SUCCESSFUL", {
                rideId: event.payload.rideId,
                riderId: event.payload.riderId,
                amount: event.payload.fareEstimate,
                status: "COMPLETED",
                transactionId: `tx_${Date.now()}`
              });
            }, 2000);
          }
        } catch (err) {
          console.error("Error processing message:", err);
        }
      },
    });

  } catch (error) {
    console.error("Failed to connect Kafka Consumer", error);
  }

  return consumer;
}

export const disconnectKafkaConsumer = async () => {
  if (consumer) {
    await consumer.disconnect();
    console.log("Payment Service disconnected from Kafka Consumer");
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
