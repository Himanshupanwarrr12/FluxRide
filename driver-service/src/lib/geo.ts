import { redis } from "./redis.js";

// Redis GEO key for online drivers
const GEO_KEY = "drivers:online";

/**
 * Add or update a driver's location in the geo set.
 * Called when a driver goes ONLINE or updates their location.
 */
export const addDriverLocation = async (
  driverId: string,
  lat: number,
  lng: number
): Promise<void> => {
  // GEOADD key longitude latitude member
  await redis.geoadd(GEO_KEY, lng, lat, driverId);
};

/**
 * Remove a driver from the geo set.
 * Called when a driver goes OFFLINE or ON_RIDE.
 */
export const removeDriverLocation = async (driverId: string): Promise<void> => {
  await redis.zrem(GEO_KEY, driverId);
};

export interface NearbyDriver {
  driverId: string;
  distanceKm: number;
}

/**
 * Find all online drivers within a given radius.
 * Uses GEOSEARCH (Redis 6.2+) — falls back to GEORADIUS for older Redis.
 */
export const findNearbyDrivers = async (
  lat: number,
  lng: number,
  radiusKm: number
): Promise<NearbyDriver[]> => {
  // GEOSEARCH key FROMMEMBER|FROMLONLAT lon lat BYRADIUS radius unit [ASC|DESC] [COUNT count] [WITHCOORD] [WITHDIST]
  const results = await redis.call(
    "GEOSEARCH",
    GEO_KEY,
    "FROMLONLAT",
    String(lng),
    String(lat),
    "BYRADIUS",
    String(radiusKm),
    "km",
    "ASC",
    "WITHDIST"
  ) as [string, string][];

  return results.map(([driverId, dist]) => ({
    driverId: driverId ?? "",
    distanceKm: parseFloat(dist ?? "0"),
  }));
};
