import type { UserEventType } from "./events.js";

/**
 * Standardized Kafka event envelope structure required across microservices.
 */
export interface KafkaEventEnvelope<T = unknown> {
  event: UserEventType;
  version: number;
  timestamp: string;
  source: string;
  correlationId: string;
  data: T;
}

/**
 * Payload schemas for User domain events.
 */
export interface UserCreatedPayload {
  userId: string;
  email: string;
  phone?: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export interface UserLoggedInPayload {
  userId: string;
  email: string;
  role: string;
}

export interface UserProfileUpdatedPayload {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface UserPasswordChangedPayload {
  userId: string;
}

export interface UserDeletedPayload {
  userId: string;
}

/**
 * Mapping of event names to their strongly typed payload interfaces.
 */
export interface UserEventPayloadMap {
  USER_CREATED: UserCreatedPayload;
  USER_LOGGED_IN: UserLoggedInPayload;
  USER_PROFILE_UPDATED: UserProfileUpdatedPayload;
  USER_PASSWORD_CHANGED: UserPasswordChangedPayload;
  USER_DELETED: UserDeletedPayload;
}
