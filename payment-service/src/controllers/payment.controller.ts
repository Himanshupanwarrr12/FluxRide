import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/kafka.js";

export const processPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rideId, riderId, amount, paymentMethod } = req.body;

    if (!rideId || !riderId || !amount) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Create a pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        rideId,
        riderId,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || "CARD",
        status: "PENDING"
      }
    });

    // Mock an external gateway processing time
    // In real life, we might redirect to a Stripe Checkout session
    // and wait for a webhook to complete the transaction.
    
    // Simulating immediate success for this demo:
    const completedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: { 
        status: "COMPLETED",
        transactionId: `gw_${Date.now()}` // Mock Gateway ID
      }
    });

    // Publish event
    await publishEvent("payment.events", "PAYMENT_SUCCESSFUL", {
      transactionId: completedTransaction.id,
      rideId: completedTransaction.rideId,
      riderId: completedTransaction.riderId,
      amount: completedTransaction.amount,
      status: completedTransaction.status
    });

    res.status(200).json({
      message: "Payment processed successfully",
      transaction: completedTransaction
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rideId } = req.params;
    
    const transaction = await prisma.transaction.findFirst({
      where: { rideId },
      orderBy: { createdAt: 'desc' }
    });

    if (!transaction) {
      res.status(404).json({ error: "Transaction not found for this ride" });
      return;
    }

    res.status(200).json({ transaction });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
