import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const registerDriver = async (req: Request, res: Response) => {
  try {
    const { userId, licenseNumber, vehicleModel, vehicleNumber, vehicleType } = req.body;

    // Basic validation
    if (!userId || !licenseNumber || !vehicleModel || !vehicleNumber || !vehicleType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const validVehicleTypes = ["CAR", "BIKE", "AUTO"];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({ message: "Invalid vehicle type. Must be CAR, BIKE, or AUTO" });
    }

    // Check if driver already exists
    const existingDriver = await prisma.driver.findFirst({
      where: {
        OR: [
          { userId },
          { licenseNumber },
          { vehicleNumber }
        ],
      },
    });

    if (existingDriver) {
      return res.status(400).json({ message: "Driver with this userId, license, or vehicle number already exists" });
    }

    // Create driver
    const driver = await prisma.driver.create({
      data: {
        userId,
        licenseNumber,
        vehicleModel,
        vehicleNumber,
        vehicleType,
        status: "PENDING", 
      },
    });

    res.status(201).json({
      message: "Driver registered successfully",
      driver,
    });
  } catch (error: unknown) {
    console.error("Driver Register Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};

export const getDriverProfile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const driver = await prisma.driver.findUnique({
      where: { id },
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.status(200).json({ driver });
  } catch (error: unknown) {
    console.error("Get Driver Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    res.status(500).json({ message: "Internal server error", error: errorMessage });
  }
};
