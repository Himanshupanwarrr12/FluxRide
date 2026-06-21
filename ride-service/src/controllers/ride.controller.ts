import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { publishEvent } from "../lib/kafka.js";

// Distance helper (mock implementation for fare estimate)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  // Simple euclidean distance * 100 for a mock fare
  const dx = lat1 - lat2;
  const dy = lon1 - lon2;
  return Math.sqrt(dx * dx + dy * dy) * 100;
};

export const requestRide = async (req: Request, res: Response) => {
  try {
    const { riderId, pickupLat, pickupLng, dropLat, dropLng, pickupAddress, dropAddress, vehicleType } = req.body;

    if (!riderId || pickupLat === undefined || pickupLng === undefined || dropLat === undefined || dropLng === undefined || !vehicleType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const validVehicleTypes = ["CAR", "BIKE", "AUTO"];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({ message: "Invalid vehicle type" });
    }

    const fareEstimate = calculateDistance(pickupLat, pickupLng, dropLat, dropLng);

    const ride = await prisma.ride.create({
      data: {
        riderId,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        pickupAddress,
        dropAddress,
        vehicleType,
        fareEstimate,
        status: "REQUESTED",
      },
    });

    // Fire and forget kafka event
    publishEvent("ride-events", "ride.requested", {
      rideId: ride.id,
      riderId,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      vehicleType,
      fareEstimate,
    });

    res.status(201).json({
      message: "Ride requested successfully",
      ride,
    });
  } catch (error: unknown) {
    console.error("Request Ride Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const acceptRide = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: "driverId is required" });
    }

    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    if (ride.status !== "REQUESTED") {
      return res.status(400).json({ message: "Ride is not in REQUESTED status" });
    }

    const updatedRide = await prisma.ride.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        driverId,
        acceptedAt: new Date(),
      },
    });

    publishEvent("ride-events", "ride.accepted", {
      rideId: id,
      driverId,
      status: "ACCEPTED",
    });

    res.status(200).json({ message: "Ride accepted", ride: updatedRide });
  } catch (error: unknown) {
    console.error("Accept Ride Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const startRide = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== "ACCEPTED") return res.status(400).json({ message: "Ride must be ACCEPTED to start" });

    const updatedRide = await prisma.ride.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    publishEvent("ride-events", "ride.started", {
      rideId: id,
      status: "IN_PROGRESS",
    });

    res.status(200).json({ message: "Ride started", ride: updatedRide });
  } catch (error: unknown) {
    console.error("Start Ride Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const completeRide = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== "IN_PROGRESS") return res.status(400).json({ message: "Ride must be IN_PROGRESS to complete" });

    const updatedRide = await prisma.ride.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    publishEvent("ride-events", "ride.completed", {
      rideId: id,
      riderId: ride.riderId,
      driverId: ride.driverId,
      fare: ride.fareEstimate,
      status: "COMPLETED",
    });

    res.status(200).json({ message: "Ride completed", ride: updatedRide });
  } catch (error: unknown) {
    console.error("Complete Ride Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const cancelRide = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (!["REQUESTED", "ACCEPTED"].includes(ride.status)) {
      return res.status(400).json({ message: "Ride cannot be cancelled at this stage" });
    }

    const updatedRide = await prisma.ride.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    publishEvent("ride-events", "ride.cancelled", {
      rideId: id,
      status: "CANCELLED",
    });

    res.status(200).json({ message: "Ride cancelled", ride: updatedRide });
  } catch (error: unknown) {
    console.error("Cancel Ride Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const getRideById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    res.status(200).json({ ride });
  } catch (error: unknown) {
    console.error("Get Ride By Id Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const getRidesByRider = async (req: Request, res: Response) => {
  try {
    const riderId = req.params.riderId as string;
    const rides = await prisma.ride.findMany({ where: { riderId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ rides });
  } catch (error: unknown) {
    console.error("Get Rides By Rider Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const getRidesByDriver = async (req: Request, res: Response) => {
  try {
    const driverId = req.params.driverId as string;
    const rides = await prisma.ride.findMany({ where: { driverId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ rides });
  } catch (error: unknown) {
    console.error("Get Rides By Driver Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};
