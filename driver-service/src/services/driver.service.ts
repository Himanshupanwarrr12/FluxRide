import { prisma } from "../lib/prisma.js";
import { addDriverLocation, removeDriverLocation, findNearbyDrivers } from "../lib/geo.js";
import { publishDriverRegistered, publishLocationUpdated } from "../kafka/eventPublisher.js";

// ── Register Driver Profile ──────────────────────────────────────────────────

export const registerDriverProfile = async (data: {
  userId: string;
  licenseNumber: string;
}) => {
  const { userId, licenseNumber } = data;

  const existing = await prisma.driver.findFirst({
    where: { OR: [{ userId }, { licenseNumber }] },
  });

  if (existing) {
    throw new Error("Driver with this userId or license number already exists");
  }

  const driver = await prisma.driver.create({
    data: { userId, licenseNumber },
    include: { vehicle: true },
  });

  await publishDriverRegistered({
    driverId: driver.id,
    userId: driver.userId,
    licenseNumber: driver.licenseNumber,
  });

  return { driver };
};

// ── Add Vehicle ──────────────────────────────────────────────────────────────

export const addVehicle = async (
  driverId: string,
  data: { model: string; plateNumber: string; type: "CAR" | "BIKE" | "AUTO" }
) => {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error("Driver not found");

  const existingVehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (existingVehicle) throw new Error("Driver already has a registered vehicle");

  const plateConflict = await prisma.vehicle.findUnique({
    where: { plateNumber: data.plateNumber },
  });
  if (plateConflict) throw new Error("Vehicle with this plate number already exists");

  const vehicle = await prisma.vehicle.create({
    data: { driverId, ...data },
  });

  return { vehicle };
};

// ── Toggle Availability ──────────────────────────────────────────────────────

export const toggleAvailability = async (
  driverId: string,
  status: "ONLINE" | "OFFLINE"
) => {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { vehicle: true },
  });

  if (!driver) throw new Error("Driver not found");

  if (status === "ONLINE" && !driver.vehicle) {
    throw new Error("Driver must register a vehicle before going online");
  }

  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: { status },
    include: { vehicle: true },
  });

  if (status === "OFFLINE" || status === "ONLINE") {
    if (status === "OFFLINE") {
      await removeDriverLocation(driverId);
    }
    // Location will be added by first PUT /location call when ONLINE
  }

  return { driver: updated };
};

// ── Update Location ──────────────────────────────────────────────────────────

export const updateDriverLocation = async (
  driverId: string,
  lat: number,
  lng: number
) => {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error("Driver not found");

  if (driver.status === "OFFLINE") {
    throw new Error("Driver must be online to update location");
  }

  // Update Redis GEO regardless of ONLINE or ON_RIDE
  await addDriverLocation(driverId, lat, lng);

  // Publish Kafka event (fire and forget)
  await publishLocationUpdated({
    driverId,
    lat,
    lng,
    timestamp: new Date().toISOString(),
  });

  return { message: "Location updated" };
};

// ── Find Nearby Drivers ──────────────────────────────────────────────────────

export const getNearbyDrivers = async (
  lat: number,
  lng: number,
  radiusKm: number
) => {
  const nearby = await findNearbyDrivers(lat, lng, radiusKm);

  if (nearby.length === 0) return { drivers: [] };

  const driverIds = nearby.map((n) => n.driverId);

  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds }, status: "ONLINE" },
    include: { vehicle: true },
  });

  // Merge distance info
  const result = drivers.map((d) => ({
    ...d,
    distanceKm: nearby.find((n) => n.driverId === d.id)?.distanceKm ?? 0,
  }));

  result.sort((a, b) => a.distanceKm - b.distanceKm);

  return { drivers: result };
};

// ── Get Driver Profile (own) ─────────────────────────────────────────────────

export const getDriverByUserId = async (userId: string) => {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    include: { vehicle: true },
  });

  if (!driver) throw new Error("Driver not found");
  return { driver };
};

// ── Get Driver By ID (internal) ──────────────────────────────────────────────

export const getDriverById = async (id: string) => {
  const driver = await prisma.driver.findUnique({
    where: { id },
    include: { vehicle: true },
  });

  if (!driver) throw new Error("Driver not found");
  return { driver };
};

// ── Mark Driver Available (used by Kafka ride handlers) ──────────────────────

export const markDriverAvailable = async (driverId: string) => {
  await prisma.driver.update({
    where: { id: driverId },
    data: { status: "ONLINE" },
  });
};

// ── Mark Driver On Ride (used by Kafka ride handlers) ────────────────────────

export const markDriverOnRide = async (driverId: string) => {
  await prisma.driver.update({
    where: { id: driverId },
    data: { status: "ON_RIDE" },
  });
  await removeDriverLocation(driverId);
};
