import { Kafka, type Consumer } from "kafkajs";
import "dotenv/config";
import { sendEmail } from "../services/email.service.js";

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";

export const kafka = new Kafka({
  clientId: "notification-service",
  brokers: [KAFKA_BROKER],
});

let consumer: Consumer | null = null;

export const connectKafkaConsumer = async () => {
  if (consumer) return consumer;

  consumer = kafka.consumer({ groupId: "notification-service-group" });
  try {
    await consumer.connect();
    console.log("Notification Service connected to Kafka Consumer");
    
    // Subscribe to topics
    await consumer.subscribe({ topic: "ride.events", fromBeginning: true });
    await consumer.subscribe({ topic: "payment.events", fromBeginning: true });
    
    // Run consumer
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        
        try {
          const event = JSON.parse(message.value.toString());
          console.log(`[Notification Service] Received Event: ${event.eventType} from topic ${topic}`);
          
          if (event.eventType === "RIDE_REQUESTED") {
            await sendEmail(event.payload.riderId, "Ride Requested", "Your ride has been successfully requested.");
          } else if (event.eventType === "RIDE_ACCEPTED") {
            await sendEmail(event.payload.riderId, "Ride Accepted", `Your ride has been accepted by driver ${event.payload.driverId}.`);
          } else if (event.eventType === "RIDE_COMPLETED") {
            await sendEmail(event.payload.riderId, "Ride Completed", `Your ride is completed. Fare: $${event.payload.fareEstimate}`);
          } else if (event.eventType === "PAYMENT_SUCCESSFUL") {
            await sendEmail(event.payload.riderId, "Payment Successful", `Your payment of $${event.payload.amount} was successful. TX ID: ${event.payload.transactionId}`);
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
    console.log("Notification Service disconnected from Kafka Consumer");
  }
};
