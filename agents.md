# Kafka Architecture

## Event-Driven Communication

FluxRide follows an event-driven architecture using Apache Kafka. Services should communicate through domain events rather than direct HTTP requests whenever possible.

### Kafka Responsibilities

Each service is responsible for publishing events that originate from its own domain.

Examples:

- user-service → User lifecycle events
- driver-service → Driver lifecycle events
- ride-service → Ride lifecycle events
- payment-service → Payment lifecycle events
- notification-service → Consumes events from other services

---

## Topic Naming Convention

Topics must represent a business domain instead of individual actions.

Examples:

user.events
driver.events
ride.events
payment.events
notification.events

Avoid creating topics like:

signup
login
driver-created
payment-success

Those should be event names, not topic names.

---

## Event Naming Convention

Events should always be written in UPPER_SNAKE_CASE.

Examples:

USER_CREATED
USER_LOGGED_IN
USER_PROFILE_UPDATED
USER_DELETED

DRIVER_REGISTERED
DRIVER_VERIFIED

RIDE_REQUESTED
RIDE_ACCEPTED
RIDE_STARTED
RIDE_COMPLETED
RIDE_CANCELLED

PAYMENT_INITIATED
PAYMENT_COMPLETED
PAYMENT_FAILED

---

## Event Envelope

Every Kafka message must follow the same structure.

```ts
{
  event: "USER_CREATED",
  version: 1,
  timestamp: "...",
  source: "user-service",
  correlationId: "...",
  data: {
    // event payload
  }
}
```

Never publish raw database objects directly.

---

## Kafka Folder Structure

Each service should keep Kafka-related code isolated.

src/
 └── kafka/
      ├── kafka.service.ts
      ├── producer.ts
      ├── consumer.ts
      ├── topics.ts
      ├── events.ts
      ├── eventPublisher.ts
      └── types.ts

Business services should never call KafkaJS directly.

Instead use semantic methods like:

publishUserCreated()
publishRideRequested()
publishPaymentCompleted()

---

## Design Principles

- Kafka infrastructure must be separated from business logic.
- Do not duplicate producer logic.
- Keep topics centralized.
- Keep event names centralized.
- Use strong TypeScript types.
- Implement graceful shutdown.
- Retry transient failures.
- Log publish failures.
- Messages should be versioned for future compatibility.

---

## Service Boundaries

Each service may only publish events belonging to its own domain.

Example:

user-service
    ✅ USER_CREATED
    ✅ USER_UPDATED

    ❌ DRIVER_REGISTERED
    ❌ RIDE_STARTED

driver-service
    ✅ DRIVER_REGISTERED

    ❌ USER_CREATED

ride-service
    ✅ RIDE_REQUESTED
    ✅ RIDE_COMPLETED

    ❌ PAYMENT_COMPLETED

This keeps ownership clear and avoids coupling between microservices.

---

## Future Compatibility

When adding new Kafka events:

1. Add the event constant.
2. Add/update the payload type.
3. Add a semantic publish method.
4. Reuse the common event envelope.
5. Avoid breaking existing event schemas. Prefer versioning over changing payloads.