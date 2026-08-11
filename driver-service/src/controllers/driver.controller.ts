import type { Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import {
  registerDriverProfile,
  addVehicle,
  toggleAvailability,
  updateDriverLocation,
  getNearbyDrivers,
  getDriverByUserId,
  getDriverById,
} from "../services/driver.service.js";

// POST /api/drivers/register
export const registerDriver = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { licenseNumber } = req.body as { licenseNumber?: string };
    if (!licenseNumber) {
      res.status(400).json({ message: "licenseNumber is required" });
      return;
    }

    const result = await registerDriverProfile({ userId, licenseNumber });
    res.status(201).json({ message: "Driver registered successfully", ...result });
  } catch (error: unknown) {
    console.error("[registerDriver]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("already exists")) {
      res.status(400).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};

// POST /api/drivers/vehicle
export const addDriverVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { model, plateNumber, type } = req.body as {
      model?: string;
      plateNumber?: string;
      type?: string;
    };

    if (!model || !plateNumber || !type) {
      res.status(400).json({ message: "model, plateNumber, and type are required" });
      return;
    }

    const validTypes = ["CAR", "BIKE", "AUTO"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: "type must be CAR, BIKE, or AUTO" });
      return;
    }

    // Look up the driver record by userId
    const { driver } = await getDriverByUserId(userId);

    const result = await addVehicle(driver.id, {
      model,
      plateNumber,
      type: type as "CAR" | "BIKE" | "AUTO",
    });

    res.status(201).json({ message: "Vehicle added successfully", ...result });
  } catch (error: unknown) {
    console.error("[addDriverVehicle]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Driver not found") {
      res.status(404).json({ message: msg });
      return;
    }
    if (msg.includes("already")) {
      res.status(400).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};

// PUT /api/drivers/availability
export const setAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { status } = req.body as { status?: string };
    if (!status || !["ONLINE", "OFFLINE"].includes(status)) {
      res.status(400).json({ message: "status must be ONLINE or OFFLINE" });
      return;
    }

    const { driver: driverRecord } = await getDriverByUserId(userId);
    const result = await toggleAvailability(driverRecord.id, status as "ONLINE" | "OFFLINE");

    res.status(200).json({ message: `Driver is now ${status}`, ...result });
  } catch (error: unknown) {
    console.error("[setAvailability]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Driver not found") {
      res.status(404).json({ message: msg });
      return;
    }
    if (msg.includes("register a vehicle")) {
      res.status(400).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};

// PUT /api/drivers/location
export const updateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ message: "latitude and longitude are required" });
      return;
    }

    const { driver: driverRecord } = await getDriverByUserId(userId);
    const result = await updateDriverLocation(driverRecord.id, latitude, longitude);

    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("[updateLocation]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Driver not found") {
      res.status(404).json({ message: msg });
      return;
    }
    if (msg.includes("must be online")) {
      res.status(400).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};

// GET /api/drivers/nearby
export const nearbyDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radius } = req.query as {
      latitude?: string;
      longitude?: string;
      radius?: string;
    };

    if (!latitude || !longitude) {
      res.status(400).json({ message: "latitude and longitude are required" });
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = radius ? parseFloat(radius) : 5;

    if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
      res.status(400).json({ message: "latitude, longitude, and radius must be valid numbers" });
      return;
    }

    const result = await getNearbyDrivers(lat, lng, radiusKm);
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("[nearbyDrivers]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};

// GET /api/drivers/profile
export const getOwnProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const result = await getDriverByUserId(userId);
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("[getOwnProfile]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Driver not found") {
      res.status(404).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};

// GET /api/drivers/:id  (internal use)
export const getDriverByIdHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };
    if (!id) {
      res.status(400).json({ message: "Driver ID is required" });
      return;
    }

    const result = await getDriverById(id);
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error("[getDriverByIdHandler]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "Driver not found") {
      res.status(404).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error", error: msg });
  }
};
