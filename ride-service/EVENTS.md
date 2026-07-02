# Ride Service Events

This document details the Kafka events published by the `ride-service`. All events are published to the `ride-events` topic.

## Standard Message Envelope
All events are wrapped in a standard JSON envelope:
```json
{
  "eventType": "string",
  "timestamp": "ISO-8601 DateTime",
  "payload": { ... }
}
```

---

## Published Events

### 1. `ride.requested`
Fired when a rider successfully creates a new ride request.

**Topic:** `ride-events`

**Payload:**
```json
{
  "rideId": "UUID",
  "riderId": "UUID",
  "pickupLat": "Float",
  "pickupLng": "Float",
  "dropLat": "Float",
  "dropLng": "Float",
  "vehicleType": "CAR | BIKE | AUTO",
  "fareEstimate": "Float"
}
```

### 2. `ride.accepted`
Fired when a driver accepts a pending ride request.

**Topic:** `ride-events`

**Payload:**
```json
{
  "rideId": "UUID",
  "driverId": "UUID",
  "status": "ACCEPTED"
}
```

### 3. `ride.started`
Fired when the driver picks up the rider and starts the ride.

**Topic:** `ride-events`

**Payload:**
```json
{
  "rideId": "UUID",
  "status": "IN_PROGRESS"
}
```

### 4. `ride.completed`
Fired when the ride reaches its destination and completes. **Note:** This event should be consumed by the `payment-service` to initiate fare processing.

**Topic:** `ride-events`

**Payload:**
```json
{
  "rideId": "UUID",
  "riderId": "UUID",
  "driverId": "UUID",
  "fare": "Float",
  "status": "COMPLETED"
}
```

### 5. `ride.cancelled`
Fired when either the rider or driver cancels the ride before it is completed.

**Topic:** `ride-events`

**Payload:**
```json
{
  "rideId": "UUID",
  "status": "CANCELLED"
}
```
