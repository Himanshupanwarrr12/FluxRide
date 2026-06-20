# AI Agent Context — FluxRide

This file provides essential context for any AI coding agent assisting with the FluxRide project.

## Project Overview
FluxRide is a microservices-based ride-sharing application built with event-driven architecture using Apache Kafka and Zookeeper. The backend consists of 5 independent services orchestrated via Docker Compose.

## Tech Stack & Conventions
- **Language**: TypeScript (`module: "nodenext"`, `target: "esnext"`)
- **Runtime Environment**: Node.js (with `tsx` for dev environment)
- **Framework**: Express 5
- **ORM**: Prisma (`v7.8.0`, but effectively Prisma 5 behavior).
  - *Note*: We use `@prisma/adapter-pg` along with `pg` for connection pooling.
  - The Prisma client is generated into `../src/generated/prisma`.
- **Database**: PostgreSQL 15 (Shared db `fluxride_db` defined in `docker-compose.yaml`)
- **Event Broker**: Apache Kafka (using `kafkajs`)
- **Code Style**: Strict TypeScript, async/await, try/catch blocks for error handling, explicit status codes, consistent JSON response formatting.

## Microservices Architecture

| Service | Port | Status | Responsibilities |
|---------|------|--------|------------------|
| `user-service` | 3001 | Built | Auth (bcrypt), JWT, User Profile Management. Has its own `schema.prisma`. |
| `driver-service` | 3002 | Built | Driver registration, vehicle details. Has its own `schema.prisma`. |
| `ride-service` | TBD | Empty | Ride requests, matching, fare estimates, status tracking. |
| `payment-service` | TBD | Empty | Transactions, invoices, payment gateway processing. |
| `notification-service` | TBD | Empty | Consumes Kafka events to send SMS/Email alerts. |

## Important Architectural Decisions
1. **Isolated Databases**: Each service maintains its own Prisma schema and does not share tables natively. Connections between entities (e.g., Driver -> User) are made via generic ID references (`userId: String`).
2. **Prisma Singleton Pattern**: Database connections must be pooled using the custom adapter in `src/lib/prisma.ts`. Do not instantiate raw `new PrismaClient()` in controllers to avoid connection limit exhaustion during development hot-reloading.
3. **Inter-service Communication**: Services communicate asynchronously via Apache Kafka. No direct HTTP calls should be made between services unless strictly necessary for real-time synchronous data retrieval.
4. **Environment Variables**: Every service relies on a `.env` file (not committed to git). `DATABASE_URL` is mandatory.

## Common Agent Tasks & Reminders
- When scaffolding a new service, copy the established patterns from `user-service` and `driver-service` (e.g., `src/index.ts`, `src/lib/prisma.ts`).
- When modifying a `schema.prisma`, remember to run `npx prisma generate`.
- Do not add packages globally. Run `npm install` inside the specific service directory.
- Check `tsconfig.json` carefully for module resolution errors when adding new file imports (ensure `.js` extensions are used in imports).
